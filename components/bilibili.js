import fetch from "node-fetch";
import common from "../common/commonFunction.js";
import runtimeRender from '../common/runtimeRender.js'
import moment from "moment";

const BiliVideoApiUrl = "https://api.bilibili.com/x/web-interface/view?bvid=";
const BiliHost = "https://www.bilibili.com";

/**
 * 设置B站登录Cookie（仅主人可操作）
 * Cookie获取方式：浏览器登录 https://www.bilibili.com 后，打开开发者工具复制Cookie
 * （常用字段：SESSDATA、bili_jct、buvid3 等）
 * @param {*} e 
 */
function setBiliCookie(e) {
  if (!e.isMaster) {
    e.reply("哒咩，只有主人可以设置B站Cookie哦");
    return false;
  }
  let ck = e.msg.split(' ').slice(1).join(' ').trim();
  if (!ck) {
    e.reply("Cookie呢？我那么大个Cookie呢？\n示例：#B站登录ck SESSDATA=xxx; bili_jct=xxx");
    return false;
  }
  common.saveData("BilibiliCookies", ck, "yaml");
  e.reply("B站Cookie设置成功\n之后解析B站视频时会以该账号的登录态获取内容~");
  return true;
}

function msgAnalyse(e) {
  return biliAnalyse(e);
}

/**
 * 判断是否为直播分享消息（B站直播分享不解析）
 * 直播分享卡片特征：desc 形如 “UP主：xxx-房间号：yyy”，标题含“直播间”，或链接直达 live.bilibili.com
 * @param {string} msg 提取后的消息文本
 * @param {object} json json卡片数据
 */
function isLiveShareMsg(msg, json) {
  // 链接直接指向直播房间
  if (typeof msg === 'string' && msg.includes('live.bilibili.com')) {
    return true
  }
  if (!json || typeof json !== 'object') {
    return false
  }
  let news = json.meta?.news || {}
  let detail = json.meta?.detail_1 || {}
  let desc = String(news.desc || detail.desc || '')
  let title = String(news.title || detail.title || '')
  let url = String(news.jumpUrl || detail.qqdocurl || '')
  return (
    url.includes('live.bilibili.com') ||
    desc.includes('房间号') ||
    desc.includes('直播间') ||
    title.includes('直播间')
  )
}

/**
 * 渲染B站视频解析卡片
 */
async function renderCard(e, data) {
  return await runtimeRender(e, '/analysePanel/bvAnalyse.html', data, {
    escape: false,
    scale: 1.6
  });
}

/**
 * B站解析测试
 * 示例：B站解析测试 BV1xxxxxx
 */
async function biliAnalyseTest(e) {
  let bv = (e.msg.match(/BV[0-9A-Za-z]{10}/) || [])[0]
  if (!bv) {
    e.reply("示例：B站解析测试 BV1xxxxxx")
    return false
  }
  e.msg = BiliHost + '/video/' + bv
  e.message = []
  e.raw_message = e.msg
  return biliAnalyse(e, true)
}

/**
 * 带超时的fetch：b23.tv/bilibili接口偶发连接挂起，若无超时会一直等待导致"消息没解析"（重发又好了）
 * @param {string} url 
 * @param {object} options fetch选项
 * @param {number} timeout 超时毫秒，默认10秒
 */
function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/**
 * 带超时和重试的fetch：超时/网络错误/5xx 都自动重试，最多重试5次（共6次尝试）后才抛出
 * @param {string} url 
 * @param {object} options fetch选项
 * @param {number} timeout 单次超时毫秒
 * @param {number} retries 重试次数，默认5
 */
async function fetchRetry(url, options = {}, timeout = 10000, retries = 5) {
  let lastErr
  for (let i = 0; i <= retries; i++) {
    try {
      let res = await fetchWithTimeout(url, options, timeout)
      if (res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`)
      } else {
        return res
      }
    } catch (err) {
      lastErr = err
    }
    if (i < retries) {
      logger.warn(`bilibili-Analyse: 请求失败(${i + 1}/${retries + 1}次尝试) ${url} ${lastErr?.name || lastErr?.message}，${500 * (i + 1)}ms后重试`)
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    } else {
      logger.error(`bilibili-Analyse: 请求失败(${i + 1}/${retries + 1}次尝试) ${url} ${lastErr?.name || lastErr?.message}`)
    }
  }
  throw lastErr
}

/**
 * 将网络图片下载为base64内嵌，避免渲染截图时网络未加载完导致图片显示不全
 * 下载失败时回退为原URL，由渲染端继续加载
 */
async function getImageBase64(url, cookie = '') {
  if (!url) return ''
  try {
    let headers = {
      'User-Agent': common.BiliReqHeaders['user-agent'] || '',
      'Referer': BiliHost + '/'
    }
    if (cookie) {
      headers.cookie = cookie
    }
    let res = await fetchWithTimeout(url, { headers }, 8000)
    if (!res.ok) {
      return url
    }
    let buf = Buffer.from(await res.arrayBuffer())
    let type = res.headers.get('content-type') || 'image/jpeg'
    return 'data:' + type + ';base64,' + buf.toString('base64')
  } catch (e) {
    return url
  }
}

/**
 * B站视频解析
 * @param {*} e 
 * @param {boolean} isTest 测试命令不受解析开关限制
 */
async function biliAnalyse(e, isTest = false) {
  //解析开关关闭时不处理（测试命令不受影响）
  if (!isTest && !common.isAnalyseEnabled("bili")) {
    return false
  }

  // 复制一份公共请求头，避免修改全局配置
  let biliReqHeaders = { ...common.BiliReqHeaders }
  let biliCookies = common.readData("BilibiliCookies", "yaml")
  if (biliCookies) {
    biliReqHeaders.cookie = biliCookies
  }

  // 消息文本：json/分享卡片会把原始字符串拼进 e.msg，其中的链接斜杠是转义形式（\/），先归一化
  let msg = String(e.msg || '').replace(/\\\//g, '/')

  // 从消息段里提取卡片链接（json/分享卡片，不限于第一段，兼容"文字+卡片"混合消息）
  let cardJson = null
  for (const seg of e.message || []) {
    if (seg.type === 'json') {
      try {
        let json = JSON.parse(seg.data)
        cardJson = json
        msg = json?.meta?.detail_1?.qqdocurl || json?.meta?.news?.jumpUrl || msg
      } catch (err) {
        logger.error('bilibili-Analyse: json卡片解析失败', err)
      }
    } else if (seg.type === 'share' && seg.data?.url) {
      msg = seg.data.url
    }
  }

  logger.debug(`bilibili-Analyse: 规则触发 segments=${e.message?.length} msgType=${e.message?.[0]?.type} 提取=${String(msg).slice(0, 80)}`)

  try {
    // 直播分享消息（如"房间号：xxx"卡片、live.bilibili.com 直链）不解析
    if (isLiveShareMsg(msg, cardJson)) {
      logger.info('bilibili-Analyse: 直播分享消息，跳过解析')
      return false
    }

    let urllist = ['b23.tv', 'bilibili.com']
    let reg2 = new RegExp(urllist.join('|'))
    if (!msg.match(reg2)) {
      logger.debug(`bilibili-Analyse: 无B站链接，跳过 (${String(msg).slice(0, 50)})`)
      return false
    }

    let bilireg = /BV[0-9A-Za-z]{10}/
    let bv = msg.match(bilireg)
    if (!bv) {
      // 短链接：先访问一次，获取跳转后的真实链接再解析（兼容 http/https、无协议头、短码含 -/_）
      let shortUrl = msg.match(/https?:\/\/b23\.tv\/[A-Za-z0-9\-_]+/)?.[0]
      if (!shortUrl) {
        let bare = msg.match(/b23\.tv\/[A-Za-z0-9\-_]+/)?.[0]
        if (bare) {
          shortUrl = 'https://' + bare
        }
      }
      if (!shortUrl) {
        logger.debug(`bilibili-Analyse: 未找到b23.tv短链，跳过 (${String(msg).slice(0, 50)})`)
        return false
      }
      let res = await fetchRetry(shortUrl, { method: "get", headers: biliReqHeaders })
      // 短链接跳转到直播房间则不解析（直播分享不解析）
      if (res.url.includes('live.bilibili.com')) {
        logger.info('bilibili-Analyse: 短链接跳转到直播房间，跳过解析')
        return false
      }
      bv = res.url.match(bilireg)
      if (!bv) {
        e.reply("B站短链接解析失败")
        return false
      }
    }

    let videoInfo = (await fetchRetry(BiliVideoApiUrl + bv[0], { method: "get", headers: biliReqHeaders }).then(res => res.json()))?.data || {}

    let upInfo = {}
    if (videoInfo?.owner?.mid) {
      let upInfoUrl = 'https://api.bilibili.com/x/relation/stat?vmid=' + videoInfo.owner.mid
      upInfo = (await fetchRetry(upInfoUrl, { method: "get", headers: biliReqHeaders }).then(res => res.json()))?.data || {}
    }

    // 封面图/头像提前下载为base64内嵌，防止渲染截图时网络未加载完导致图片显示不全
    let [pic, upFace] = await Promise.all([
      getImageBase64(videoInfo?.pic ? videoInfo.pic + '@480w_320h_!web-avatar.png' : '', biliCookies),
      getImageBase64(videoInfo?.owner?.face ? videoInfo.owner.face + '@60w_60h_!web-avatar.png' : '', biliCookies)
    ])

    let videoTitle = videoInfo.title || '未知标题'
    let videoDesc = formatVideoDesc(videoInfo.desc)
    let videoDuration = convertSecondsToHMS(videoInfo.duration || 0)
    let videoTime = videoDuration[1].toString().padStart(2, '0') + ':' + videoDuration[2].toString().padStart(2, '0')
    if (videoDuration[0] > 1) {
      videoTime = videoDuration[0] + ':' + videoTime
    }
    // 优先用发布时间 pubdate（定时发布的视频 pubdate 是定时发布时间，ctime 只是上传时间，会显示成凌晨）
    let createTime = moment(new Date((videoInfo.pubdate || videoInfo.ctime || 0) * 1000)).format('YYYY-MM-DD HH:mm:ss')
    let upName = videoInfo?.owner?.name || '未知UP主'
    let playTimes = formatNum(videoInfo?.stat?.view)
    let danmaku = formatNum(videoInfo?.stat?.danmaku)
    let reply = formatNum(videoInfo?.stat?.reply)
    let favorite = formatNum(videoInfo?.stat?.favorite)
    let coin = formatNum(videoInfo?.stat?.coin)
    let share = formatNum(videoInfo?.stat?.share)
    let like = formatNum(videoInfo?.stat?.like)
    let fans = formatNum(upInfo?.follower)

    let data = { pic, videoTitle, videoDesc, videoTime, upName, upFace, playTimes, danmaku, reply, favorite, coin, share, like, fans, createTime }

    await renderCard(e, data)
    return false
  } catch (error) {
    // 网络请求超时/中断：给出友好提示，而不是静默（重发可再次触发解析）
    if (error?.name === 'AbortError') {
      logger.error('bilibili-Analyse: 请求超时', error)
      return await e.reply('B站接口请求超时，请稍后重试~')
    }
    logger.error('bilibili-Analyse', error)
    return await e.reply(error.message)
  }
}

/**
 * 简介排版：统一换行符、去首尾空白（不截断）
 */
function formatVideoDesc(desc) {
  if (!desc) {
    return '没有简介'
  }
  return String(desc).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

/**
 * 数字格式化：过万显示为 x.x万
 */
function formatNum(num) {
  num = Number(num) || 0
  if (num > 10000) {
    return Math.round(num / 1000) / 10 + '万'
  }
  return num
}

function convertSecondsToHMS(seconds) {
  var hours = Math.floor(seconds / 3600); // 计算小时部分
  seconds %= 3600; // 取余得到不足1小时的秒数

  var minutes = Math.floor(seconds / 60); // 计算分钟部分
  seconds %= 60; // 取余得到不足1分钟的秒数

  return [hours, minutes, seconds];
}

/**
 * 开启|关闭B站视频解析
 * @param {*} e 
 */
function updateBvAnalyse(e) {
  if (!common.adminAllow(e)) {
    return false
  }
  if (e.msg.includes("开启")) {
    common.setAnalyseEnabled("bili", true)
    e.reply("B站视频解析已开启~")
    return true
  }
  if (e.msg.includes("关闭")) {
    common.setAnalyseEnabled("bili", false)
    e.reply("B站视频解析已关闭~")
    return true
  }
  return false
}

export default {
  msgAnalyse,
  updateBvAnalyse,
  biliAnalyseTest,
  setBiliCookie
}
