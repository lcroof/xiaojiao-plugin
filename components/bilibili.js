import fs from "fs";
import fetch from "node-fetch";
import common from "../common/commonFunction.js";
import runtimeRender from '../common/runtimeRender.js'
import moment from "moment";
import push from '../components/biliPush.js'

const _path = process.cwd();
const filePath = `${_path}/data/PushNews/`

if (!fs.existsSync(filePath)) {
  fs.mkdirSync(filePath);
}

let BilibiliPushConfig = {}; // 推送配置
let PushBilibiliDynamic = {}; // 推送对象列表
const BiliVideoApiUrl = "https://api.bilibili.com/x/web-interface/view?bvid=";

const BiliReqHeaders = {
  'cookie': '',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'zh-CN,zh;q=0.9',
  'cache-control': 'max-age=0',
  'sec-ch-ua': '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': "Windows",
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.50',
}

const BotHaveARest = 500; // 机器人每次发送间隔时间，腹泻式发送会不会不太妥？休息一下吧
const BiliApiRequestTimeInterval = 2000; // B站动态获取api间隔多久请求一次，别太快防止被拉黑

const DynamicPicCountLimit = 2; // 推送动态时，限制发送多少张图片
const DynamicContentLenLimit = 50; // 推送文字和图文动态时，限制字数是多少
const DynamicContentLineLimit = 3; // 推送文字和图文动态时，限制多少行文本

let nowPushDate = Date.now(); // 设置当前推送的开始时间
let pushTimeInterval = 10; // 推送间隔时间，单位：分钟
let BilibiliCookies = "";

// 延长过期时间的定义
let DynamicPushTimeInterval = 60 * 60 * 1000; // 过期时间，单位：小时，默认一小时，范围[1,24]

/**
 * 初始化获取B站推送信息
 */
async function initBiliPushJson() {
  if (fs.existsSync(filePath + "PushBilibiliDynamic.json")) {
    PushBilibiliDynamic = common.readData("PushBilibiliDynamic", "json");
    for (var item in PushBilibiliDynamic) {
      item.isNewsPush = item.isNewsPush === "true" ? true : false;
      item.isGroup = item.isGroup === "true" ? true : false;
    }

  } else {
    common.savePushJson(PushBilibiliDynamic);
  }

  if (fs.existsSync(filePath + "BilibiliPushConfig.json")) {
    BilibiliPushConfig = common.readData(filePath, "json");

    // 如果设置了过期时间
    let faultTime = Number(BilibiliPushConfig.dynamicPushFaultTime);
    let temp = DynamicPushTimeInterval;
    if (!isNaN(faultTime)) {
      temp = common.getRightTimeInterval(faultTime);
      temp = temp < 1 ? 1 : temp; // 兼容旧设置
      temp = temp > 24 ? 24 : temp; // 兼容旧设置
      temp = temp * 60 * 60 * 1000;
    }
    DynamicPushTimeInterval = temp; // 允许推送多久以前的动态

    // 如果设置了间隔时间
    let timeInter = Number(BilibiliPushConfig.dynamicPushTimeInterval);
    if (!isNaN(timeInter)) {
      pushTimeInterval = common.getRightTimeInterval(timeInter);
    }

  } else {
    common.savePushJson(BilibiliPushConfig);
  }
}

/**
 * 开启|关闭B站推送
 * @param {*} e 
 */
export async function changeBilibiliPush(e) {
  if (!common.functionAllow(e)) {
    return false;
  }

  // 推送对象记录
  let pushID = "";
  if (e.isGroup) {
    pushID = e.group_id;
  } else {
    return false;
  }
  if (!pushID) {
    return true;
  }

  if (e.msg.includes("开启")) {
    let info = PushBilibiliDynamic[pushID];
    if (!info) {
      PushBilibiliDynamic[pushID] = {
        isNewsPush: true, // 是否开启了推送
        adminPerm: true, // 默认群聊时，仅管理员拥有权限，此状态为false时，连狗管理都没有权限，但是定时任务会推动态
        isGroup: e.isGroup || false,
        biliUserList: [{ uid: "401742377", name: "原神" }], // 默认推送原神B站
        pushTarget: pushID,
        pushTargetName: e.isGroup ? e.group_name : e.sender?.nickname,
      };
    } else {
      PushBilibiliDynamic[pushID].isNewsPush = true;
    }
    common.savePushJson(PushBilibiliDynamic);
    Bot.logger.mark(`开启B站动态推送:${pushID}`);
    e.reply(`B站动态推送已开启了\n每间隔${pushTimeInterval}分钟会自动检测一次有没有新动态\n如果有的话会自动发送动态内容到这里的~`);
  }

  if (e.msg.includes("关闭")) {
    if (PushBilibiliDynamic[pushID]) {
      PushBilibiliDynamic[pushID].isNewsPush = false;
      common.savePushJson(PushBilibiliDynamic);
      Bot.logger.mark(`关闭B站动态推送:${pushID}`);
      e.reply("本群的B站动态推送已关闭");
    } else {
      e.reply("你还妹在这里开启过B站动态推送呢");
    }
  }

  return true;
}

// (开启|关闭|允许|禁止)群B站推送
export async function changeGroupBilibiliPush(e) {
  if (!e.isMaster) {
    return false;
  }

  let commands = e.msg.split("群B站推送");
  let command = commands[0];
  let groupID = commands[1].trim();

  if (!groupID) {
    e.reply(`群ID呢？我那么大个群ID呢？\n示例：${command}群B站推送 248635791`);
    return true;
  }
  if (isNaN(Number(groupID))) {
    e.reply(`${groupID} <- 群ID不存在\n示例：${command}群B站推送 248635791`);
    return true;
  }

  let group = Bot.gl.get(Number(groupID));
  if (!group) {
    e.reply("我不在这个群里哦");
    return true;
  }
  // 没有开启过的话，那就给初始化一个
  if (!PushBilibiliDynamic[groupID]) {
    PushBilibiliDynamic[groupID] = {
      isNewsPush: true,
      adminPerm: true,
      isGroup: true,
      biliUserList: [{ uid: "401742377", name: "原神" }], // 默认推送原神B站
      pushTarget: groupID,
      pushTargetName: group.group_name,
    };
  }

  switch (command) {
    case "开启":
    case "#开启":
      PushBilibiliDynamic[groupID].isNewsPush = true;
      break;
    case "关闭":
    case "#关闭":
      PushBilibiliDynamic[groupID].isNewsPush = false;
      break;
  }

  common.savePushJson(PushBilibiliDynamic);
  e.reply(`【${group.group_name}】设置${command}推送成功~`);

  return true;
}

/**
 * 新增|删除B站动态推送UID
 * @param {*} e 
 */
export async function updateBilibiliPush(e) {
  if (new RegExp(/(订阅|增加|新增)/).test(e.msg)) {
    push.createBiliPush(e);
  }
  if (new RegExp(/(移除|去除|取消)/).test(e.msg)) {
    push.deleteBiliPush(e);
  }
  return true;
}

/**
 * 返回当前聊天对象推送的B站用户列表
 * @param {*} e 
 */
export async function getBilibiliPushUserList(e) {
  // 是否允许使用这个功能
  if (!common.isAllowPushFunc(e)) {
    return false;
  }

  if (e.msg.indexOf("群") > -1) {
    if (!e.isMaster) {
      e.reply("只有狗主人才可以查看所有群");
      return false;
    }

    let groupMap = Bot.gl;
    let groupList = [];

    for (let [groupID, groupObj] of groupMap) {
      groupID = "" + groupID;
      let info = PushBilibiliDynamic[groupID];
      if (!info) {
        groupList.push(`${groupObj.group_name}(${groupID})：未开启，允许使用`);
      } else {
        PushBilibiliDynamic[groupID].pushTargetName = groupObj.group_name;
        let tmp = PushBilibiliDynamic[groupID];
        groupList.push(
          `${groupObj.group_name}(${groupID})：${tmp.isNewsPush ? "已开启" : "已关闭"}，${tmp.adminPerm === false ? "无权限" : "有权限"}，${tmp.allowPush === false ? "禁止使用" : "允许使用"
          }`
        );
      }
    }

    e.reply(`B站推送各群使用情况：\n${groupList.join("\n")}`);

    return true;
  }

  // 推送对象记录
  let pushID = "";
  if (e.isGroup) {
    pushID = e.group_id;
  } else {
    return false;
  }
  if (!pushID) {
    return true;
  }
  if (!PushBilibiliDynamic[pushID]) {
    return e.reply("开启过B站推送才能查哦");
  }

  let push = PushBilibiliDynamic[pushID];
  let info = push.biliUserList
    .map((item) => {
      return `${item.name}：${item.uid}`;
    })
    .join("\n");
  let status = push.isNewsPush ? "开启" : "关闭";

  e.reply(`当前B站推送是【${status}】状态哦\n推送的B站用户有：\n${info}`);

  return true;
}

export async function setBiliPushCookie(e) {
  if (!e.isMaster) {
    return false;
  }
  BilibiliCookies = e.msg;
  common.saveData("BilibiliCookies", e.msg, "yaml");

  return true;
}

// 设置B站推送定时任务时间
export async function setBiliPushTimeInterval(e) {
  if (!e.isMaster) {
    return false;
  }

  let time = e.msg.split("B站推送时间")[1].trim();
  time = Number(time);

  if (time <= 0 || time >= 60) {
    e.reply("时间不能乱填哦\n时间单位：分钟，范围[1-60)\n示例：B站推送时间 10");
    return true;
  }

  BilibiliPushConfig.dynamicPushTimeInterval = time;
  await common.savePushJson(BilibiliPushConfig);
  e.reply(`设置间隔时间 ${time}分钟 成功，重启后生效~\n请手动重启或者跟我说#重启`);

  return true;
}

// 设置B站推送过期时间，对，就直接从上面搬下来了，为什么这么懒？就这么懒！
export async function setBiliPushFaultTime(e) {
  if (!e.isMaster) {
    return false;
  }

  let time = e.msg.split("B站推送过期时间")[1].trim();
  time = Number(time);

  if (time < 1 || time > 24) {
    e.reply("时间不能乱填哦\n时间单位：小时，范围[1-24]\n示例：B站推送过期时间 1");
    return true;
  }

  BilibiliPushConfig.dynamicPushFaultTime = time;
  await common.savePushJson(BilibiliPushConfig);
  e.reply(`设置过期时间 ${time}小时 成功，重启后生效\n请手动重启或者跟我说#重启`);

  return true;
}

/**
 * 开启|关闭B站转发推送
 * @param {*} e 
 */
export async function changeBiliPushTransmit(e) {
  if (!common.functionAllow(e)) {
    return false;
  }

  let pushID = "";
  if (e.isGroup) {
    pushID = e.group_id;
  } else {
    return false;
  }
  let info = PushBilibiliDynamic[pushID];
  if (!info) {
    e.reply("你还妹在这里开启过B站动态推送呢");
    return true;
  }

  if (e.msg.indexOf("开启") > -1) {
    PushBilibiliDynamic[pushID].pushTransmit = true;
    e.reply("转发动态推送已开启");
  }
  if (e.msg.indexOf("关闭") > -1) {
    PushBilibiliDynamic[pushID].pushTransmit = false;
    e.reply("转发动态推送已关闭");
  }

  await common.savePushJson(PushBilibiliDynamic);

  return true;
}

/**
 * 设置B站推送(默认|合并|图片)
 * @param {*} e 
 */
export async function setBiliPushSendType(e) {
  if (!common.functionAllow(e)) {
    return false;
  }

  let pushID = "";
  if (e.isGroup) {
    pushID = e.group_id;
  } else {
    return false;
  }
  let info = PushBilibiliDynamic[pushID];
  if (!info) {
    e.reply("你还妹在这里开启过B站动态推送呢");
    return true;
  }

  let type = e.msg.substr(e.msg.length - 2);
  let typeCode = "";
  switch (type) {
    case "默认":
      typeCode = "default";
      break;
    case "合并":
      typeCode = "merge";
      break;
    case "图片":
      typeCode = "picture";
      break;
  }
  if (e.msg.indexOf("全局") > -1) {
    BilibiliPushConfig.sendType = typeCode;
    type = "全局" + type;
    await common.savePushJson(BilibiliPushConfig);
  } else {
    PushBilibiliDynamic[pushID].sendType = typeCode;
    await common.savePushJson(PushBilibiliDynamic);
  }

  e.reply(`设置B站推送方式：【${type}】成功！`);

  return true;
}

function msgAnalyse(e) {
  biliAnalyse(e);
}

async function renderCard(e, data) {
  let type = await runtimeRender(e, '/analysePanel/bvAnalyse.html', data, {
    escape: false,
    scale: 1.6,
    retType: 'base64'
  })
  return type;
}

async function biliAnalyse(e) {
  //获取cookies
  BiliReqHeaders.cookie = BilibiliCookies;
  let msg = e.msg
  let urllist = ['b23.tv', 'm.bilibili.com', 'www.bilibili.com']
  let reg2 = new RegExp(`${urllist[0]}|${urllist[1]}|${urllist[2]}`)
  if (!msg && e.raw_message != '[json消息]' && e.raw_message != '[xml消息]') {
    return false
  }

  //这段是测试用，输入原json到内容框内即可用
  if (process.argv.includes('dev')) {
    let json = JSON.parse(e.message[0].text)
    msg = json.meta.detail_1?.qqdocurl || json.meta.news?.jumpUrl
  }

  if (e.raw_message == '[json消息]') {
    let json = JSON.parse(e.message[0].data)
    msg = json.meta.detail_1?.qqdocurl || json.meta.news?.jumpUrl
  }
  if (e.raw_message == '[xml消息]') {
    logger.warn(msg.toString())
  }
  if (!msg.match(reg2)) {
    return false
  }

  let url = msg
  let bilireg = /(BV.*?).{10}/
  let bv = url.match(bilireg)
  let videoInfo = {}
  if (bv) {
    // 存在bv长链接
    bv = bv[0]
  } else {
    // 如果为短链接，先访问一次之后获取新的url再获取一次
    await fetch(url, { method: "get", headers: BiliReqHeaders }).then(res => {
      bv = res.url.match(bilireg)[0]
    })
  }
  let bvUrl = BiliVideoApiUrl + `${bv}`
  videoInfo = (await fetch(bvUrl, { method: "get", headers: BiliReqHeaders }).then(res => res.json()))?.data || {}
  let upInfoUrl = 'https://api.bilibili.com/x/relation/stat?vmid=' + videoInfo.owner.mid;
  let upInfo = (await fetch(upInfoUrl, { method: "get", headers: BiliReqHeaders }).then(res => res.json()))?.data || {}

  let pic = videoInfo.pic
  let videoTitle = videoInfo.title
  let videoDesc = videoInfo.desc.length > 0 ? videoInfo.desc : '没有简介'
  let videoDuration = convertSecondsToHMS(videoInfo.duration)
  let videoTime = videoDuration[1].toString().padStart(2, '0') + ":" + videoDuration[2].toString().padStart(2, '0')
  if (videoDuration[0] > 1) {
    videoTime = videoDuration[0] + ":" + videoTime
  }
  let createTime = moment(new Date(videoInfo.ctime * 1000)).format('YYYY-MM-DD HH:mm:ss')
  let upName = videoInfo.owner.name
  let upFace = videoInfo.owner.face
  let playTimes = videoInfo.stat.view > 10000 ? Math.round(videoInfo.stat.view / 1000) / 10 + "万" : videoInfo.stat.view
  let danmaku = videoInfo.stat.danmaku > 10000 ? Math.round(videoInfo.stat.danmaku / 1000) / 10 + "万" : videoInfo.stat.danmaku
  let reply = videoInfo.stat.reply > 10000 ? Math.round(videoInfo.stat.reply / 1000) / 10 + "万" : videoInfo.stat.reply
  let favorite = videoInfo.stat.favorite > 10000 ? Math.round(videoInfo.stat.favorite / 1000) / 10 + "万" : videoInfo.stat.favorite
  let coin = videoInfo.stat.coin > 10000 ? Math.round(videoInfo.stat.coin / 1000) / 10 + "万" : videoInfo.stat.coin
  let share = videoInfo.stat.share > 10000 ? Math.round(videoInfo.stat.share / 1000) / 10 + "万" : videoInfo.stat.share
  let like = videoInfo.stat.like > 10000 ? Math.round(videoInfo.stat.like / 1000) / 10 + "万" : videoInfo.stat.like
  let fans = upInfo.follower > 10000 ? Math.round(upInfo.follower / 1000) / 10 + "万" : upInfo.follower

  let data = { pic, videoTitle, videoDesc, videoTime, upName, upFace, playTimes, danmaku, reply, favorite, coin, share, like, fans, createTime }

  try {
    // 渲染数据
    await renderCard(e, data);
    return false;
  } catch (error) {
    logger.error('bilibili-Analyse', error)
    return await e.reply(error.message)
  }
}

function convertSecondsToHMS(seconds) {
  var hours = Math.floor(seconds / 3600); // 计算小时部分
  seconds %= 3600; // 取余得到不足1小时的秒数

  var minutes = Math.floor(seconds / 60); // 计算分钟部分
  seconds %= 60; // 取余得到不足1分钟的秒数

  return [hours, minutes, seconds];
}

export default {
  updateBilibiliPush,
  getBilibiliPushUserList,
  changeGroupBilibiliPush,
  setBiliPushCookie,
  setBiliPushTimeInterval,
  setBiliPushFaultTime,
  changeBiliPushTransmit,
  setBiliPushSendType,
  initBiliPushJson,
  msgAnalyse
};