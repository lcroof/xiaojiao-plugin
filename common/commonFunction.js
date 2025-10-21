import fs from "fs";
const _path = process.cwd();

let packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const yunzaiVersion = packageJson.version;
export const isV3 = yunzaiVersion[0] === "3";

let config;
if (isV3) {
    const YAML = await import("yaml");

    let configUrl = `${_path}/config/config`;
    
    let other = YAML.parse(fs.readFileSync(`${configUrl}//other.yaml`, "utf8"));
    let group = YAML.parse(fs.readFileSync(`${configUrl}//group.yaml`, "utf8"));
    let qq = []
    qq.push(other.master[0].split(':').shift())

    config = { qq, other, group, masterQQ: other.masterQQ, account: qq };
} else {
    config = BotConfig;
}

export const botConfig = config;
export const BiliReqHeaders = {
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

/**
 * 发送私聊消息，非好友以临时聊天发送
 * @param {*} user_id qq号
 * @param {*} msg 消息
 * @param {*} isStranger 是否给陌生人发消息,默认false
 * @returns 
 */
async function relpyPrivate(user_id, msg, isStranger = false) {
    user_id = parseInt(user_id);

    let friend = Bot.fl.get(user_id);
    if (friend) {
        Bot.logger.mark(`发送好友消息[${friend.nickname}](${user_id})`);
        Bot.pickUser(user_id)
            .sendMsg(msg)
            .catch((err) => {
                Bot.logger.mark(err);
            });
        redis.incr(`Yunzai:sendMsgNum:${botConfig.account.qq}`);
        return;
    } else {
        //是否给陌生人发消息
        if (!isStranger) {
            return;
        }
        let key = `Yunzai:group_id:${user_id}`;
        let group_id = await redis.get(key);

        if (!group_id) {
            for (let group of Bot.gl) {
                group[0] = parseInt(group[0]);
                let MemberInfo = await Bot.getGroupMemberInfo(group[0], user_id).catch(
                    (err) => { }
                );
                if (MemberInfo) {
                    group_id = group[0];
                    redis.set(key, group_id.toString(), { EX: 1209600 });
                    break;
                }
            }
        } else {
            group_id = parseInt(group_id);
        }

        if (group_id) {
            Bot.logger.mark(`发送临时消息[${group_id}]（${user_id}）`);

            let res = await Bot.pickMember(group_id, user_id)
                .sendMsg(msg)
                .catch((err) => {
                    Bot.logger.mark(err);
                });

            if (res) {
                redis.expire(key, 86400 * 15);
            } else {
                return;
            }

            redis.incr(`Yunzai:sendMsgNum:${BotConfig.account.qq}`);
        } else {
            Bot.logger.mark(`发送临时消息失败：[${user_id}]`);
        }
    }
}

/**
 * 消息合并工具函数
 * @param {Array} messages 需要合并的消息列表，必填
 * @param {Boolean} isGroup 是否发送到群，必填，false时为发送到个人
 * @param {String} title 标题
 */
async function replyMake(messages, isGroup, title) {
    let nickname = Bot.nickname;

    // 组装消息
    let msgList = [];
    messages.forEach((msg) => {
        msgList.push({
            message: msg, // 合并消息中的每一个单项消息
            nickname: nickname, // 机器人名字
            user_id: Bot.uin, // 机器人的QQ号
        });
    });

    let forwardMsg = await Bot.makeForwardMsg(msgList, !isGroup);

    if (title) {
        // 处理合并消息在点开前看到的描述
        forwardMsg.data.forEach((msg)=>{
            if (typeof msg.message === 'string') {
                msg.message = msg.message.toString().replace(/\n/g, "");
            }
        })
    }

    return forwardMsg;
}

/**
 * 休眠函数
 * @param {number} ms 毫秒
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取现在时间到今天23:59:59秒的秒数
 */
function getDayEnd() {
    let now = new Date();
    let dayEnd =
        new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            "23",
            "59",
            "59"
        ).getTime() / 1000;

    return dayEnd - parseInt(now.getTime() / 1000);
}

/**
 * 是不是狗管理或者狗群主
 * @param {*} e oicq的消息对象
 */
function isGroupAdmin(e = {}) {
    let isAdmin = e?.sender?.role === "admin";
    let isOwner = e?.sender?.role === "owner";

    return isAdmin || isOwner;
}

/**
 * 根据给到的数据，返回一个 1 - 60 的整数或者false
 * @param {number} num 
 * @returns 
 */
function getRightTimeInterval(num) {
    num = Number(num);
    if (isNaN(num)) return false;

    if (num > 60) return 60;
    if (num <= 0) return 1;

    return num;
}

/**
 * 是否允许推送
 * @param {*} e 
 * @returns 
 */
function isAllowPushFunc(e) {
    if (e.isMaster) return true; // master当然是做什么都可以咯

    let pushID = "";
    if (e.isGroup) {
        pushID = e.group_id;
    } else {
        // 私聊禁止使用哦
        if (!BilibiliPushConfig.allowPrivate) {
            return false;
        }
        pushID = e.user_id;
    }

    let info = config[pushID];
    if (!info) return true;

    if (info.isGroup && info.adminPerm === false) return false;

    return info.allowPush !== false;
}

function isAllowUrlAnaylseFunc(e) {
    if (e.isMaster) {
        return true;
    }
    let info = "";
    if (e.isGroup) {
        info = "";
    }
}

/**
 * 判断当前不是默认推送方式
 * @param {string} info 
 * @param {*} config 
 * @returns 
 */
function getSendType(info, config) {
    if (config.sendType && config.sendType != "default") return config.sendType;
    if (info.sendType) return info.sendType;
    return "default";
}

/**
 * 存储B站推送配置信息
 * @param {*} config 
 */
function savePushJson(config) {
    this.saveData('PushBilibiliDynamic', config, 'json');
}

/**
 * 存储B站推送配置信息
 * @param {*} config 
 */
function saveConfigJson(config) {
    this.saveData('BilibiliPushConfig', config, 'json');
}

const dataDir = _path + '/data/PushNews/'

/**
 * 保存文件
 * @param {string} filename 
 * @param {string} data 
 * @param {string} fileType 
 * @returns 
 */
function saveData(filename, data, fileType) {
    // 判断目录是否存在，不存在则创建
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
    }
    try {
        if (fileType === 'json') {
            fs.writeFileSync(
                `${dataDir}/${filename}.json`,
                JSON.stringify(data, null, '\t'),
                'utf-8'
            )
            return true
        } else {
            fs.writeFileSync(
                `${dataDir}/${filename}.${fileType}`, data, 'utf-8'
            )
            return true
        }
    } catch (err) {
        logger.error('写入失败：', err)
        return false
    }
}

/**
 * 读取文件
 * @param {string} filename 
 * @param {string} fileType 
 * @returns 
 */
function readData(filename, fileType) {
    // 文件路径
    const filePath = `${dataDir}/${filename}.${fileType}`
    // 判断文件是否存在并读取文件
    if (fs.existsSync(filePath)) {
        if (fileType === 'json') {
            return JSON.parse(fs.readFileSync(filePath))
        } else {
            return fs.readFileSync(filePath)
        }
    } else {
        return "";
    }
}

/**
 * 是否允许使用这个功能
 * @param {*} e 
 */
function functionAllow(e) {
    if (!isAllowPushFunc(e)) {
        return false;
    }

    if (e.isGroup && !isGroupAdmin(e) && !e.isMaster) {
        e.reply("哒咩，只有管理员和master可以操作哦");
        return false;
    }
    return true;
}

async function bilibiliUrlPost(url) {
    let BilibiliCookies;
    if (readData("BilibiliCookies", "yaml") !== "") {
        BilibiliCookies = readData("BilibiliCookies", "yaml");
    }

    if (BilibiliCookies === "") {
        this.e.reply("没有设置cookies，你可以执行命令\n#B站推送ck [你的ck]\n来进行设置");
        return true;
    }

    BiliReqHeaders.cookie = BilibiliCookies;
    const response = await fetch(url, { method: "get", headers: BiliReqHeaders });

    if (!response.ok) {
        this.e.reply("好像连不到B站了捏");
        return true;
    }

    const res = await response.json();

    if (res.code == '-352') {
        this.e.reply("B站ck已过期，你可以执行命令\n#B站推送ck [你的ck]\n来替换过期的ck");
        return true;
    }
    return res;
}



export default {
    relpyPrivate,
    replyMake,
    sleep,
    getDayEnd,
    isGroupAdmin,
    getRightTimeInterval,
    isAllowPushFunc,
    getSendType,
    savePushJson,
    saveConfigJson,
    functionAllow,
    saveData,
    readData,
    bilibiliUrlPost,
    BiliReqHeaders
};