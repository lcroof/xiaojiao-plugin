import common from "../common/commonFunction.js";
import { botConfig } from "../common/commonFunction.js"
import schedule from "node-schedule";
import { segment } from "oicq";
import fs from "fs";

const _path = process.cwd();
const filePath = `${_path}/data/PushNews/`

if (!fs.existsSync(filePath)) {
  fs.mkdirSync(filePath);
}

let BilibiliPushConfig = {}; // 推送配置
let PushBilibiliDynamic = {}; // 推送对象列表
let dynamicPushHistory = []; // 历史推送，仅记录推送的消息ID，不记录本体对象，用来防止重复推送的
let nowDynamicPushList = new Map(); // 本次新增的需要推送的列表信息

const BiliDynamicApiUrl = "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space";
const BiliDrawDynamicLinkUrl = "https://m.bilibili.com/dynamic/"; // 图文动态链接地址

const BotHaveARest = 500; // 机器人每次发送间隔时间，腹泻式发送会不会不太妥？休息一下吧
const BiliApiRequestTimeInterval = 2000; // B站动态获取api间隔多久请求一次，别太快防止被拉黑

const DynamicPicCountLimit = 2; // 推送动态时，限制发送多少张图片
const DynamicContentLenLimit = 50; // 推送文字和图文动态时，限制字数是多少
const DynamicContentLineLimit = 3; // 推送文字和图文动态时，限制多少行文本

let nowPushDate = Date.now(); // 设置当前推送的开始时间
let pushTimeInterval = 10; // 推送间隔时间，单位：分钟

// 延长过期时间的定义
let DynamicPushTimeInterval = 60 * 60 * 1000; // 过期时间，单位：小时，默认一小时，范围[1,24]

/**
 * 初始化获取B站推送信息
 */
function initBiliPushJson() {
  if (fs.existsSync(filePath + "PushBilibiliDynamic.json")) {
    PushBilibiliDynamic = common.readData("PushBilibiliDynamic", "json");
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
    common.saveConfigJson(BilibiliPushConfig);
  }
}

/**
 * 删除推送
 * @param {*} e 
 * @returns 
 */
export async function deleteBiliPush(e) {
  if (!common.functionAllow(e)) {
    return false;
  }

  // 推送对象记录
  let pushID = "";
  if (e.isGroup) {
    pushID = e.group_id;
  }
  if (!pushID) {
    return true;
  }

  let temp = PushBilibiliDynamic[pushID];

  if (!temp) {
    e.reply("你还妹在这里开启过B站动态推送呢");
    return true;
  }

  let msgList = e.msg.split("推送");
  const delComms = ["删除", "移除", "去除", "取消", "#删除", "#移除", "#去除", "#取消"];

  let uid = msgList[1].trim();
  let operComm = msgList[0];

  // uid或者用户名可不能缺
  if (!uid) {
    e.reply(`UID呢？我那么大个UID呢？\n示例：B站${operComm}删除推送 401742377`);
    return true;
  }

  let uids = temp.biliUserList.map((item) => item.uid);
  let names = temp.biliUserList.map((item) => item.name);

  // 删除B站推送的时候，可以传UID也可以传用户名
  if (delComms.indexOf(operComm) > -1) {
    let isExist = false;

    if (uids.indexOf(uid) > -1) {
      PushBilibiliDynamic[pushID].biliUserList = temp.biliUserList.filter((item) => item.uid != uid);
      isExist = true;
    }
    if (names.indexOf(uid) > -1) {
      PushBilibiliDynamic[pushID].biliUserList = temp.biliUserList.filter((item) => item.name != uid);
      isExist = true;
    }

    if (!isExist) {
      e.reply("这个UID没有添加过，无法删除");
      return true;
    }

    common.savePushJson(PushBilibiliDynamic);
    e.reply(`${uid}已删除`);

    return true;
  }
  return true;
}

/**
 * 建立推送
 * @param {*} e 
 * @returns 
 */
export async function createBiliPush(e) {
  if (!common.functionAllow(e)) {
    return false;
  }

  initBiliPushJson();

  // 推送对象记录
  let pushID = "";
  if (e.isGroup) {
    pushID = e.group_id;
  }
  if (!pushID) {
    return true;
  }

  let temp = PushBilibiliDynamic[pushID];

  let msgList = e.msg.split("推送");
  const addComms = ["B站订阅", "B站添加", "B站新增", "B站增加", "#B站订阅", "#B站添加", "#B站新增", "#B站增加"];

  let uid = msgList[1].trim();
  let operComm = msgList[0];

  let uids = temp.biliUserList.map((item) => item.uid);

  if (isNaN(Number(uid))) {
    e.reply(`${uid} <- UID不存在？\n示例：B站${operComm}新增推送 401742377`);
    return true;
  }

  // 添加只能是 uid 的方式添加
  if (addComms.indexOf(operComm) > -1) {
    if (uids.indexOf(uid) > -1) {
      e.reply("这UID已经加过了");
      return true;
    }

    let url = `${BiliDynamicApiUrl}?host_mid=${uid}`;
    let res = await common.bilibiliUrlPost(url);

    // if (res) {
    //   return true;
    // }

    if (res.code != 0) {
      e.reply("UID信息无返回，请检查UID是否正确");
      return true;
    }

    let data = res?.data || null;
    if (!data) {
      e.reply("UID信息无返回，请检查UID是否正确");
      return true;
    }

    data = res?.data?.items || [];
    if (data.length === 0) {
      data.name = uid;
    } else {
      let dynamic = data[0];
      data.name = dynamic?.modules?.module_author?.name || uid;
    }

    PushBilibiliDynamic[pushID].biliUserList.push({ uid, name: data.name });
    common.savePushJson(PushBilibiliDynamic);
    e.reply(`添加成功\n${data.name}：${uid}`);
  }

  return true;
}

/**
 * 定时任务
 */
export async function task() {
  // Cron表达式，每到[5,15,25,35,45,55]分钟执行一次
  let scheduleConfig = "0 5,15,25,35,45,55 * * * ?"; // 默认
  let timeInter = Number(BilibiliPushConfig.dynamicPushTimeInterval);
  // 做好容错，防一手乱改配置文件
  if (!isNaN(timeInter)) {
    timeInter = Math.ceil(timeInter); // 确保一定是整数
    if (timeInter <= 0) timeInter = 1; // 确保一定大于等于 1

    scheduleConfig = `0 0/${timeInter} * * * ?`;
    if (timeInter >= 60) {
      scheduleConfig = `0 0 * * * ?`;
    }
  }

  // B站动态推送
  schedule.scheduleJob(scheduleConfig, () => pushScheduleJob());
}

/**
 * 推送定时任务
 * @param {*} e 
 */
export async function pushScheduleJob(e = {}) {
  if (!process.argv.includes('dev') && e.msg && !e.isMaster) {
    return false; // dev调试模式下可以主动推送
  }

  initBiliPushJson();//重新获取一次推送信息

  // 没有任何人正在开启B站推送
  if (Object.keys(PushBilibiliDynamic).length === 0) {
    return true;
  }

  // 推送之前先初始化，拿到历史推送，但不能频繁去拿，为空的时候肯定要尝试去拿
  if (dynamicPushHistory.length === 0) {
    let temp = await redis.get("bilipush:history");
    if (!temp) {
      dynamicPushHistory = [];
    } else {
      dynamicPushHistory = JSON.parse(temp);
    }
  }

  Bot.logger.mark("B站动态定时推送");

  // 将上一次推送的动态全部合并到历史记录中
  let hisArray = new Set(dynamicPushHistory);
  for (let pushList of nowDynamicPushList) {
    for (let msg of pushList) {
      hisArray.add(msg.id_str);
    }
  }
  dynamicPushHistory = [...hisArray]; // 重新赋值，这个时候dynamicPushHistory就是完整的历史推送了。
  await redis.set("bilipush:history", JSON.stringify(dynamicPushHistory), { EX: 24 * 60 * 60 }); // 仅存储一次，过期时间24小时

  nowDynamicPushList = new Map();

  let temp = PushBilibiliDynamic;
  nowPushDate = Date.now();
  for (let user in temp) {
    temp[user].pushTarget = user; // 保存推送QQ对象
    // 循环每个订阅了推送任务的QQ对象
    if (isAllowSchedulePush(temp[user])) {
      await pushDynamic(temp[user]);
    }
  }
}

/**
 * 定时任务是否给这个QQ对象推送B站动态
 * @param {*} user 
 */
function isAllowSchedulePush(user) {
  if (botConfig.masterQQ.includes(Number(user.pushTarget))) return true; // 主人的命令就是一切！

  if (!user.isNewsPush) {
    return false; // 不推那当然。。不推咯
  }

  if (!user.isGroup) {
    return false; // 不是群聊，直接禁止
  }

  return true;
}

/**
 * 动态推送
 * @param {*} pushInfo 
 */
async function pushDynamic(pushInfo) {
  let users = pushInfo.biliUserList;
  for (let i = 0; i < users.length; i++) {
    let biliUID = users[i].uid;

    // 请求这个B站用户动态
    let pushList = await getNeedPushList(biliUID);

    // 刚刚请求过了，不再请求
    if (pushList) {
      // 刚刚请求时候就没有可以推送的内容，跳过
      if (pushList.length === 0) {
        continue;
      }
      await sendDynamic(pushInfo, users[i], pushList);
      continue;
    }
    //保存已推送记录
    if (!nowDynamicPushList.has(biliUID)) {
      nowDynamicPushList.set(biliUID, pushList);
    }
    
    await common.sleep(BiliApiRequestTimeInterval);
  }

  return true;
}

/**
 * 获取需要推送的动态列表
 */
async function getNeedPushList(uid) {
  let url = `${BiliDynamicApiUrl}?host_mid=${uid}`;
  let res = await common.bilibiliUrlPost(url);

  // if (res) {
  //   return false;
  // }

  if (res.code != 0) {
    // 请求失败，不记录，跳过，下一个
    await common.sleep(BiliApiRequestTimeInterval);
    return false;
  }

  let data = res?.data?.items || [];
  if (data.length === 0) {
    // 没有动态，记录一个空数组，跳过，下一个
    await common.sleep(BiliApiRequestTimeInterval);
    return false;
  }

  let pushList = new Set()

  // 获取可以推送的动态列表
  for (let val of data) {
    let author = val?.modules?.module_author || {};

    if (!author?.pub_ts) continue; // 没有推送时间，这属于数据有问题。。。跳过，下一个

    author.pub_ts = author.pub_ts * 1000;
    // 允许推送多早以前的动态，重要，超过了设定时间则不推
    if (nowPushDate - author.pub_ts > DynamicPushTimeInterval) {
      continue;
    }

    pushList.add(val);
  }

  pushList = rmDuplicatePushList([...pushList]); // 数据去重，确保不会重复推送
  if (pushList.length === 0) {
    // 没有可以推送的，记录完就跳过，下一个
    await common.sleep(BiliApiRequestTimeInterval);
    return false;
  }

  return pushList
}

/**
 * 历史推送过的动态，这一轮不推
 * @param {*} newList 
 */
function rmDuplicatePushList(newList) {
  if (newList && newList.length === 0) return newList;
  return newList.filter((item) => {
    return !dynamicPushHistory.includes(item.id_str);
  });
}

/**
 * 发送动态内容
 * @param {*} info 
 * @param {*} biliUser 
 * @param {*} list 
 */
async function sendDynamic(info, biliUser, list) {
  let pushID = info.pushTarget;
  Bot.logger.mark(`B站动态推送[${pushID}]`);

  for (let val of list) {
    let msg = buildBiliPushSendDynamic(biliUser, val, info);
    if (msg === "can't push transmit") {
      // 这不好在前边判断，只能放到这里了
      continue;
    }
    if (!msg) {
      Bot.logger.mark(`B站动态推送[${pushID}] - [${biliUser.name}]，推送失败，动态信息解析失败`);
      continue;
    }

    let sendType = getSendType(info);
    if (sendType === "merge") {
      msg = await common.replyMake(msg, info.isGroup, msg[0]);
    }

    if (info.isGroup) {
      Bot.pickGroup(pushID)
        .sendMsg(msg)
        .catch((err) => { // 推送失败，可能仅仅是某个群推送失败
          Bot.logger.mark(err);
          common.relpyPrivate(botConfig.masterQQ, `${pushID}群推送失败\n` + err + "\n" + msg)
          pushAgain(pushID, msg);
        });
    } else {
      common.relpyPrivate(pushID, msg);
    }

    await common.sleep(BotHaveARest); // 休息一下，别一口气发一堆
  }

  return true;
}

// 群推送失败了，再推一次，再失败就算球了
async function pushAgain(groupId, msg) {
  await common.sleep(BotHaveARest);

  Bot.pickGroup(groupId)
    .sendMsg(msg)
    .catch((err) => {
      Bot.logger.mark(`群[${groupId}]推送失败：${err}`);
    });

  return true;
}

/**
 * 构建动态消息
 * @param {*} biliUser 
 * @param {*} dynamic 
 * @param {*} info 
 */
function buildBiliPushSendDynamic(biliUser, dynamic, info) {
  let desc, msg, pics;
  let title = `B站【${biliUser.name}】动态推送：`;

  // 以下对象结构参考米游社接口，接口在顶部定义了
  switch (dynamic.type) {
    case "DYNAMIC_TYPE_AV":
      desc = dynamic?.modules?.module_dynamic?.major?.archive;
      if (!desc) return;

      title = `B站【${biliUser.name}】视频动态推送：`;
      // 视频动态仅由标题、封面、链接组成
      msg = [title, desc.title, segment.image(desc.cover), resetLinkUrl(desc.jump_url)];

      return msg;
    case "DYNAMIC_TYPE_WORD":
      desc = dynamic?.modules?.module_dynamic?.desc;
      if (!desc) return;

      title = `B站【${biliUser.name}】动态推送：`;
      if (getSendType(info) != "default") {
        msg = [title, `${desc.text}`, `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`];
      } else {
        msg = [title, `${dynamicContentLimit(desc.text)}`, `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`];
      }

      return msg;
    case "DYNAMIC_TYPE_DRAW":
      desc = dynamic?.modules?.module_dynamic?.desc;
      pics = dynamic?.modules?.module_dynamic?.major?.draw?.items;
      if (!desc && !pics) return;

      pics = pics.map((item) => {
        return segment.image(item.src);
      });

      title = `B站【${biliUser.name}】图文动态推送：`;

      if (getSendType(info) != "default") {
        msg = [title, `${desc.text}`, ...pics, `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`];
      } else {
        if (pics.length > DynamicPicCountLimit) pics.length = DynamicPicCountLimit; // 最多发DynamicPicCountLimit张图，不然要霸屏了
        // 图文动态由内容（经过删减避免过长）、图片、链接组成
        msg = [title, `${dynamicContentLimit(desc.text)}`, ...pics, `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`];
      }

      return msg;
    case "DYNAMIC_TYPE_ARTICLE":
      desc = dynamic?.modules?.module_dynamic?.major?.article;
      if (!desc) return;

      pics = [];
      if (desc.covers && desc.covers.length) {
        pics = desc.covers.map((item) => {
          return segment.image(item);
        });
      }

      title = `B站【${biliUser.name}】文章动态推送：`;
      // 专栏/文章动态由标题、图片、链接组成
      msg = [title, desc.title, ...pics, resetLinkUrl(desc.jump_url)];

      return msg;
    case "DYNAMIC_TYPE_FORWARD": // 转发的动态
      let pushTransmit = info.pushTransmit;
      if (!pushTransmit) return "can't push transmit";

      desc = dynamic?.modules?.module_dynamic?.desc;
      if (!desc) return;
      if (!dynamic.orig) return;

      let orig = buildSendDynamic(biliUser, dynamic.orig, info);
      if (orig && orig.length) {
        // 掐头去尾
        orig.shift();
        orig.pop();
      } else {
        return false;
      }

      title = `B站【${biliUser.name}】转发动态推送：`;

      if (getSendType(info) != "default") {
        msg = [
          title,
          `${desc.text}\n---以下为转发内容---`,
          ...orig,
          `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`,
        ];
      } else {
        msg = [
          title,
          `${dynamicContentLimit(desc.text, 1, 15)}\n---以下为转发内容---`,
          ...orig,
          `${BiliDrawDynamicLinkUrl}${dynamic.id_str}`,
        ];
      }

      return msg;
    case "DYNAMIC_TYPE_LIVE_RCMD":
      desc = dynamic?.modules?.module_dynamic?.major?.live_rcmd?.content;
      if (!desc) return;

      desc = JSON.parse(desc);
      desc = desc?.live_play_info;
      if (!desc) return;

      title = `B站【${biliUser.name}】直播动态推送：`;
      // 直播动态由标题、封面、链接组成
      msg = [title, `${desc.title}`, segment.image(desc.cover), resetLinkUrl(desc.link)];

      return msg;
    default:
      Bot.logger.mark(`未处理的B站推送【${biliUser.name}】：${dynamic.type}`);
      return false;
  }
}

/**
 * 限制动态字数
 * @param {*} content 
 * @param {*} lineLimit 
 * @param {*} lenLimit 
 */
function dynamicContentLimit(content, lineLimit, lenLimit) {
  content = content.split("\n");

  lenLimit = lenLimit || DynamicContentLenLimit;
  lineLimit = lineLimit || DynamicContentLineLimit;

  if (content.length > lineLimit) content.length = lineLimit;

  let contentLen = 0; // 内容总长度
  let outLen = false; // 溢出 flag
  for (let i = 0; i < content.length; i++) {
    let len = lenLimit - contentLen; // 这一段内容允许的最大长度

    if (outLen) {
      // 溢出了，后面的直接删掉
      content.splice(i--, 1);
      continue;
    }
    if (content[i].length > len) {
      content[i] = content[i].substr(0, len);
      content[i] = `${content[i]}...`;
      contentLen = lenLimit;
      outLen = true;
    }
    contentLen += content[i].length;
  }

  return content.join("\n");
}

// B站返回的url有时候多两斜杠，去掉
function resetLinkUrl(url) {
  if (url.indexOf("//") === 0) {
    return url.substr(2);
  }

  return url;
}

// 判断当前不是默认推送方式
function getSendType(info) {
  if (BilibiliPushConfig.sendType && BilibiliPushConfig.sendType != "default") return BilibiliPushConfig.sendType;
  if (info.sendType) return info.sendType;
  return "default";
}

export default {
  initBiliPushJson,
  task,
  pushScheduleJob,
  createBiliPush,
  deleteBiliPush
};