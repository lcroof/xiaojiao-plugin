import fs from "fs";
const _path = process.cwd();

let packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const yunzaiVersion = packageJson.version;
export const isV3 = yunzaiVersion[0] === "3";

let config;
if (isV3) {
    const YAML = await import("yaml");

    let configUrl = `${_path}/config/config`;
    let qq = YAML.parse(fs.readFileSync(`${configUrl}/qq.yaml`, "utf8"));
    let other = YAML.parse(fs.readFileSync(`${configUrl}//other.yaml`, "utf8"));
    let group = YAML.parse(fs.readFileSync(`${configUrl}//group.yaml`, "utf8"));

    config = { qq, other, group, masterQQ: other.masterQQ, account: qq };
} else {
    config = BotConfig;
}

export const botConfig = config;

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
        forwardMsg.data = forwardMsg.data
            .replace(/\n/g, "")
            .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, "___")
            .replace(/___+/, `<title color="#777777" size="26">${title}</title>`);
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

    let info = PushBilibiliDynamic[pushID];
    if (!info) return true;

    if (info.isGroup && info.adminPerm === false) return false;

    // allowPush可能不存在，只在严格不等于false的时候才禁止
    if (info.allowPush === false) return false;

    return info.allowPush !== false;
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
async function savePushJson(config) {
    this.saveData(PushBilibiliDynamic, config, 'json');
}

/**
 * 存储B站推送配置信息
 * @param {*} config 
 */
async function saveConfigJson(config) {
    this.saveData(BilibiliPushConfig, config, 'json');
}

const dataDir = _path + '/data/PushNews/'

/**
 * 保存文件
 * @param {string} filename 
 * @param {string} data 
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
        }
        else if (fileType === 'yaml') {
            fs.writeFileSync(
                `${dataDir}/${filename}.yaml`, data, 'utf-8'
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
 * @returns 
 */
function readData(filename) {
    // 文件路径
    const filePath = `${dataDir}/${filename}.json`
    // 判断文件是否存在并读取文件
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath))
    } else {
        return []
    }
}

/**
 * @description: 读取JSON文件
 * @param {string} path 路径
 * @param {string} root 目录
 * @return {object}
 */
function readJson(file, root = pluginRoot) {
    if (fs.existsSync(`${root}/${file}`)) {
        try {
            return JSON.parse(fs.readFileSync(`${root}/${file}`, 'utf8'))
        } catch (e) {
            logger.error(e)
        }
    }
    return {}
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
    saveConfigJson
};