import common from "../common/commonFunction.js";
import runtimeRender from '../common/runtimeRender.js'
import { botConfig } from "../common/commonFunction.js"
import _, { rest } from "lodash";
import { foregroundColorNames } from "chalk";

async function ngaContext(e) {
    let msg;

    if (e.raw_message == '[json消息]') {
        let json = JSON.parse(e.message[0].data)
        msg = msg || json.meta.detail_1?.qqdocurl || json.meta.news?.jumpUrl
    }
    if (e.raw_message == '[xml消息]') {
        logger.warn(msg.toString())
    }
    if (!msg.match(/tid\=[0-9]+/)) {
        return false
    }

    //先获取NGA链接消息，得到tid
    let tid = msg.match(/tid\=[0-9]+/);
    tid = tid[0].substring(4);

    //编一个RSS申请头，POST这个tid，获取所有data
    let postUrl = `https://ngabbs.com/app_api.php?__lib=post&__act=list`;
    let postInfo = (await fetch(postUrl, {
        method: "POST",
        headers: {
            'X-User-Agent': 'NGA_skull/6.0.5(iPhone10,3;iOS 12.0.1)'
        },
        body: new FormData().append('tid', tid)
    }).then(res => res.json())) || {}

    if (postInfo.code !== '0') {
        e.reply(`未获取到主题内容`);
        return false;
    }

    let subject = postInfo.tsubject;      //主题
    let forum_name = postInfo.forum_name;     //版名
    let authorUID = postInfo.tauthorid;     //作者ID
    let hotPost = postInfo.hot_post || {};      //热评
    let replyCount = postInfo.vrows - 1;        //回复数
    let totalPage = postInfo.totalPage;        //总页数
    let currentPage = postInfo.currentPage;        //当前页
    let postResult = postInfo.result;       //回复内容

    //已获得数据，先弹出个回复
    e.reply(`已获取信息，正在生成图片`);

    if (totalPage > 2) {
        e.reply(`楼层过多，生成速度不快，请稍后`);
    }

    //重组json
    let titlePage = {};
    let tempReplyPage = {};
    let ReplyPage = {};
    for (let result in postResult) {
        if (result.lou === 0) {
            //0楼是楼主
            titlePage = {
                userName: result.author.username,
                registrationTime: moment(new Date(result.author.regdate * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                userMemberGroup: result.author.member,
                rvrc: result.author.rvrc,
                postCount: result.author.postnum,
                postContent: result.content,
                postTime: moment(new Date(result.postdatetimestamp * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                voteGood: result.vote_good,
                voteBad: result.vote_bad
            }
            if (postInfo.hot_post.length > 0) {
                let hotPostList = {};
                for (let hotPost in postInfo.hot_post) {
                    hotPostList = hotPostList || {
                        userName: hotPost.author.username,
                        content: hotPost.content
                    }
                }
                titlePage = titlePage || {
                    hotPostList: hotPostList
                }
            }
        } else {
            tempReplyPage = {
                userName: result.author.username,
                registrationTime: moment(new Date(result.author.regdate * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                userMemberGroup: result.author.member,
                rvrc: result.author.rvrc,
                postCount: result.author.postnum,
                postContent: result.content,
                postTime: moment(new Date(result.postdatetimestamp * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                voteGood: result.vote_good,
                voteBad: result.vote_bad,
                floor: result.lou
            }
        }
        if (result.isTieTiao) {
            let tieTiao = {};
            for (let comment in result.comments) {
                tieTiao = tieTiao || {
                    userName: comment.author.username,
                    content: comment.content
                }
            }
            if (tieTiao.length !== 0) {
                if (result.lou === 0) {
                    titlePage = titlePage || {
                        tietiao: tieTiao
                    }
                } else {
                    tempReplyPage = tempReplyPage || {
                        tietiao: tieTiao
                    }
                }
            }
        }
    }


    //获取标题和回复数
    let msgTitle = `NGA消息解析： https://ngabbs.com/read.php?tid=` + tid;
    let msgReply = `回复数：` + replyCount;

    //根据回复长度生成多张图片，包括主题和热评回复和贴条
    let data = [];
    let pic = renderCard(e, 'title', titlePage);
    let pics = [pic, ...pics];
    pic = renderCard(e, 'reply', data);
    pics = [pic, ...pics];

    //放在消息合并
    let sendMsg = msgCombine(ngaUrl, title, reply, pics);
    getCombineSendMsg = await common.replyMake(sendMsg, true, msg[0]);
    // Bot.pickGroup(e.group_id)
    //     .sendMsg(msg)
    //     .catch((err) => { // 推送失败，可能仅仅是某个群推送失败
    //         Bot.logger.mark(err);
    //         common.relpyPrivate(botConfig.masterQQ, `${pushID}群推送失败\n` + err + "\n" + msg)
    //         pushAgain(pushID, msg);
    //     });
}

async function renderCard(e, htmlType, data) {
    let url = ``;
    data = { 'omitBackground': '#fff', ...data }
    if (htmlType === 'title') {
        url = `/analysePanel/ngaAnalyseTitle.html`;
    }
    if (htmlType === 'title') {
        url = `/analysePanel/ngaAnalyseReply.html`;
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

function updateNgaAnalyse(e) {

}

async function ngaAnalyseTest(e) {
    e.msg = '';
    e.message = { data: `` }
    e.raw_message = '[json消息]'
    ngaContext(e);
}

export default {
    msgAnalyse,
    updateNgaAnalyse,
    ngaAnalyseTest
}