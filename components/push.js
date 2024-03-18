import common from "../common/commonFunction.js";
import { botConfig } from "../common/commonFunction.js"
import schedule from "node-schedule";
import runtimeRender from '../common/runtimeRender.js'

let BilibiliPushConfig = {}; // 推送配置
let PushBilibiliDynamic = {}; // 推送对象列表

/**
 * 初始化获取B站推送信息
 */
async function initBiliPushJson() {
    if (fs.existsSync(filePath + "PushBilibiliDynamic.json")) {
        PushBilibiliDynamic = common.readData("PushBilibiliDynamic", "json");
        for (var item in PushBilibiliDynamic) {
            item.allowPush = item.allowPush === "true" ? true : false;
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

export async function deleteBilibiliPush(e) {
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


export async function createBilibiliPush(e) {
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

    let msgList = e.msg.split("推送");
    const addComms = ["订阅", "添加", "新增", "增加", "#订阅", "#添加", "#新增", "#增加"];

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

        if (common.readData("BilibiliCookies", "yaml") !== "") {
            BilibiliCookies = common.readData("BilibiliCookies", "yaml");
        }

        if (BilibiliCookies === "") {
            e.reply("没有设置cookies，你可以执行命令\n#B站推送ck [你的ck]\n来进行设置");
            return true;
        }

        BiliReqHeaders.cookie = BilibiliCookies;
        const response = await fetch(url, { method: "get", headers: BiliReqHeaders });

        if (!response.ok) {
            e.reply("好像连不到B站了捏");
            return true;
        }

        const res = await response.json();

        if (res.code == '-352') {
            e.reply("B站ck已过期，你可以执行命令\n#B站推送ck [你的ck]\n来替换过期的ck");
            return true;
        }

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
        let preMsg = '';
        if (data.length === 0) {
            data.name = uid;
        } else {
            let dynamic = data[0];
            data.name = dynamic?.modules?.module_author?.name || uid;
        }

        PushBilibiliDynamic[pushID].biliUserList.push({ uid, name: data.name });
        common.savePushJson(PushBilibiliDynamic);
        e.reply(`${preMsg}添加成功\n${data.name}：${uid}`);
    }

    return true;
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
    updateBvAnalyse,
    updateNgaAnalyse,
    initBiliPushJson,
    task,
    pushScheduleJob,
    msgAnalyse
};