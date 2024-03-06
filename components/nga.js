import common from "../common/commonFunction.js";
import runtimeRender from '../common/runtimeRender.js'
import { botConfig } from "../common/commonFunction.js"

async function ngaContext(e) {
    //先获取NGA链接消息，得到tid
    let ngaUrl = ``;

    //编一个RSS申请头，POST这个tid，获取所有data

    //已获得数据，先弹出个回复
    e.reply(`已获取信息，正在生成图片`);

    //重组json

    //获取标题和回复数
    let title = `NGA消息解析：\n`;
    let reply = `回复数：\n`;

    //根据回复长度生成多张图片，包括主题和热评回复和贴条
    let data = [];
    let pic = renderCard(e, 'title', data);
    let pics = [pic, ...pics];
    pic = renderCard(e, 'reply', data);
    pics = [pic, ...pics];

    //放在消息合并
    let msg = msgCombine(ngaUrl, title, reply, pics);
    msg = await common.replyMake(msg, true, msg[0]);
    Bot.pickGroup(e.group_id)
        .sendMsg(msg)
        .catch((err) => { // 推送失败，可能仅仅是某个群推送失败
            Bot.logger.mark(err);
            common.relpyPrivate(botConfig.masterQQ, `${pushID}群推送失败\n` + err + "\n" + msg)
            pushAgain(pushID, msg);
        });
}

async function renderCard (e, htmlType, data) {
    let url = ``;
    data = {'omitBackground':'#fff', ...data}
    if (htmlType === 'title'){
        url =  `/analysePanel/ngaAnalyseTitle.html`;
    }
    if (htmlType === 'title'){
        url =  `/analysePanel/ngaAnalyseReply.html`;
    }
    await runtimeRender(e, url, data, {
      escape: false,
      scale: 1.6,
      retType: 'base64'
    });
  }

function msgCombine(ngaUrl, title, reply, pics) {
    let msg;
    msg = [title, reply, ngaUrl, pics];
    return msg;
}

function msgAnalyse(e) {
    ngaContext(e);
}

export default {
    msgAnalyse
}