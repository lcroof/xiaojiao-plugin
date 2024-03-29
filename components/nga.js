import common from "../common/commonFunction.js";
import runtimeRender from '../common/runtimeRender.js'
import { botConfig } from "../common/commonFunction.js"
import moment from "moment";
import fetch from "node-fetch";

async function ngaContext(e) {
    let msg = e.msg;
    let titlePage = {};
    let replyPage = {};

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

    let formData = new URLSearchParams();
    formData.append('tid', tid)

    //编一个RSS申请头，POST这个tid，获取所有data
    let postUrl = `https://ngabbs.com/app_api.php?__lib=post&__act=list`;
    let postInfo = await fetch(postUrl, {
        method: "POST",
        headers: {
            'X-User-Agent': 'NGA_skull/6.0.5(iPhone10,3;iOS 12.0.1)',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
    }).then(res => res.json());

    if (postInfo.code !== 0) {
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

    if (totalPage > 3) {
        e.reply(`楼层过多，生成速度不快，请稍后`);
    }

    //重组json
    for (let result in postResult) {
        let tempReplyPage = [];

        if (postResult[result].isTieTiao) {
            let tieTiao = [];
            for (let comment in postResult[result].comments) {
                tieTiao.push([{
                    userName: postResult[result].comments[comment].author.username,
                    content: postResult[result].comments[comment].content
                }]);
            }
            if (tieTiao.length !== 0) {
                if (postResult[result].lou === 0) {
                    titlePage = {...titlePage, ...{tietiao: tieTiao}}
                } else {
                    tempReplyPage.push([{tietiao: tieTiao}])
                }
            }
        }

        if (postResult[result].lou === 0) {
            //0楼是楼主
            titlePage = {
                userName: postResult[result].author.username,
                registrationTime: moment(new Date(postResult[result].author.regdate * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                userMemberGroup: postResult[result].author.member,
                rvrc: postResult[result].author.rvrc,
                postCount: postResult[result].author.postnum,
                postContent: postResult[result].content,
                postTime: moment(new Date(postResult[result].postdatetimestamp * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                voteGood: postResult[result].vote_good,
                voteBad: postResult[result].vote_bad
            }
            if (postInfo.hot_post.length > 0) {
                let hotPostList = [];
                for (let hotPost in postInfo.hot_post) {
                    hotPostList.push([{
                        userName: postInfo.hot_post[hotPost].author.username,
                        content: postInfo.hot_post[hotPost].content
                    }]);
                }
                titlePage = { ...titlePage, ...{ hotPostList: hotPostList } }
            }
        } else {
            tempReplyPage.concat([{
                userName: postResult[result].author.username,
                registrationTime: moment(new Date(postResult[result].author.regdate * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                userMemberGroup: postResult[result].author.member,
                rvrc: postResult[result].author.rvrc,
                postCount: postResult[result].author.postnum,
                postContent: postResult[result].content,
                postTime: moment(new Date(postResult[result].postdatetimestamp * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                voteGood: postResult[result].vote_good,
                voteBad: postResult[result].vote_bad,
                floor: postResult[result].lou
            }]);
            replyPage = {tempReplyPage};
        }
    }
    //获取标题和回复数
    let msgTitle = `NGA消息解析： https://ngabbs.com/read.php?tid=` + tid;
    let msgReply = `回复数：` + replyCount;

    //根据回复长度生成多张图片，包括主题和热评回复和贴条
    let pic = renderCardPic(e, 'reply', replyPage);

    let replypics = [];
    let newReplyPage = [];
    for (let pageCount in replyPage) {
        newReplyPage.push(replyPage[pageCount])
        if (pageCount > 0 && replyPage[pageCount].floor % 10 === 0) {
            pic = await renderCard(e, 'reply', newReplyPage);
            newReplyPage = [];
            replypics.push(pic);
        }
    }

    if (newReplyPage.length > 0) {
        pic = await renderCard(e, 'reply', newReplyPage);
        replypics.push(pic);
    }
    let ngaUrl = `https://ngabbs.com/read.php?tid=`|| tid;

    //放在消息合并
    let sendMsg = msgCombine(ngaUrl, msgTitle, msgReply, replypics);
    let getCombineSendMsg = await common.replyMake(sendMsg, true, null);
    Bot.pickGroup(e.group_id)
        .sendMsg(getCombineSendMsg)
        .catch((err) => { // 推送失败，可能仅仅是某个群推送失败
            Bot.logger.mark(err);
            common.relpyPrivate(botConfig.masterQQ, `${pushID}群推送失败\n` + err + "\n" + msg)
            pushAgain(pushID, msg);
        });
}



async function renderCard(e, htmlType, data) {
    let url = ``;
    data = { 'omitBackground': '#fff', ...data }
    if (htmlType === 'title') {
        url = `/analysePanel/ngaAnalyseTitle.html`;
    }
    if (htmlType === 'reply') {
        url = `/analysePanel/ngaAnalyseReply.html`;
    }
    return await runtimeRender(e, url, data, {
        escape: false,
        scale: 1.6,
        retType: 'base64'
    });
}

async function renderCardPic(e, htmlType, data) {
    let url = ``;
    data = { 'omitBackground': '#fff', ...data }
    if (htmlType === 'title') {
        url = `/analysePanel/ngaAnalyseTitle.html`;
    }
    if (htmlType === 'reply') {
        url = `/analysePanel/ngaAnalyseReply.html`;
    }
    await runtimeRender(e, url, data, {
        escape: false,
        scale: 1.6,
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