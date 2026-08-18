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
    let res = await fetch(url, { headers })
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

  let msg = e.msg
  let msgType = e.message?.[0]?.type

  if (!msg && msgType != 'json' && msgType != 'xml') {
    return false
  }

  try {
    if (msgType == 'json') {
      let json = JSON.parse(e.message[0].data)
      msg = json?.meta?.detail_1?.qqdocurl || json?.meta?.news?.jumpUrl || msg
    }
    if (msgType == 'xml') {
      logger.warn(msg.toString())
    }

    let urllist = ['b23.tv', 'm.bilibili.com', 'www.bilibili.com']
    let reg2 = new RegExp(urllist.join('|'))
    if (!msg.match(reg2)) {
      return false
    }

    let bilireg = /BV[0-9A-Za-z]{10}/
    let bv = msg.match(bilireg)
    if (!bv) {
      // 短链接：先访问一次，获取跳转后的真实链接再解析
      let shortUrl = msg.match(/https:\/\/b23\.tv\/[A-Za-z0-9]+/)?.[0]
      if (!shortUrl) {
        return false
      }
      let res = await fetch(shortUrl, { method: "get", headers: biliReqHeaders })
      bv = res.url.match(bilireg)
      if (!bv) {
        e.reply("B站短链接解析失败")
        return false
      }
    }

    let videoInfo = (await fetch(BiliVideoApiUrl + bv[0], { method: "get", headers: biliReqHeaders }).then(res => res.json()))?.data || {}

    let upInfo = {}
    if (videoInfo?.owner?.mid) {
      let upInfoUrl = 'https://api.bilibili.com/x/relation/stat?vmid=' + videoInfo.owner.mid
      upInfo = (await fetch(upInfoUrl, { method: "get", headers: biliReqHeaders }).then(res => res.json()))?.data || {}
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
    let createTime = moment(new Date((videoInfo.ctime || 0) * 1000)).format('YYYY-MM-DD HH:mm:ss')
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
