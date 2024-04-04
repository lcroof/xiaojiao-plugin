import common from "../common/commonFunction.js";
import runtimeRender from '../common/runtimeRender.js'
import { botConfig } from "../common/commonFunction.js"
import moment from "moment";
import fetch from "node-fetch";

async function ngaContext(e) {
    let msg = e.msg;
    let titlePage = {}
    let replyPage = {}
    let allReply = []

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
    let tid = msg.match(/tid\=[0-9]+/)
    tid = tid[0].substring(4)

    //编一个RSS申请头，POST这个tid，获取所有data
    let postUrl = `https://ngabbs.com/app_api.php?__lib=post&__act=list`
    let postInfo = await ngaUrlPost(postUrl, tid, 1)

    if (postInfo.code !== 0) {
        e.reply(`未获取到主题内容`)
        return false
    }

    let subject = postInfo.tsubject         //主题
    let forum_name = postInfo.forum_name     //版名
    let replyCount = postInfo.vrows - 1        //回复数
    let totalPage = postInfo.totalPage        //总页数
    let currentPage = postInfo.currentPage        //当前页
    let postResult = postInfo.result || {}       //回复内容
    let hotPost = postInfo.hot_post || {}       //热评

    //已获得数据，先弹出个回复
    e.reply(`已获取信息，正在生成图片`)

    if (totalPage > 3) {
        e.reply(`楼层过多，生成速度不快，请稍后`)
    }

    postResult.forEach(result => {
        allReply.push(result)
    });


    while (totalPage >= currentPage + 1) {
        postInfo = await ngaUrlPost(postUrl, tid, currentPage + 1)
        currentPage = postInfo.currentPage
        postInfo.result.forEach(result => {
            allReply.push(result)
        });
    }

    //重组json
    for (let result in allReply) {
        if (allReply[result].vote_good < 10 && allReply[result].lou > 0) {
            continue
        }
        let tempFloorReply = []

        if (allReply[result].isTieTiao) {
            let tieTiao = []
            for (let comment in allReply[result].comments) {
                tieTiao = [...tieTiao, ...[{
                    userName: allReply[result].comments[comment].author.username,
                    content: ngaContentDecode(allReply[result].comments[comment].content)
                }]]
            }
            if (tieTiao.length !== 0) {
                if (allReply[result].lou === 0) {
                    titlePage = { ...titlePage, ...{ tietiao: tieTiao } }
                } else {
                    tempFloorReply = [...tempFloorReply, ...[{ tietiao: tieTiao }]]
                }
            }
        }

        if (allReply[result].lou === 0) {
            //0楼是楼主
            titlePage = {...titlePage, ...{
                title: subject,
                userName: allReply[result].author.username,
                registrationTime: moment(new Date(allReply[result].author.regdate * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                userMemberGroup: allReply[result].author.member,
                rvrc: allReply[result].author.rvrc,
                postCount: allReply[result].author.postnum,
                postContent: ngaContentDecode(allReply[result].content),
                postTime: moment(new Date(allReply[result].postdatetimestamp * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                voteGood: allReply[result].vote_good,
                voteBad: allReply[result].vote_bad
            }}
            if (hotPost.length > 0) {
                let hotPostList = [];
                for (let post in hotPost) {
                    hotPostList = [...hotPostList, ...[{
                        userName: hotPost[post].author.username,
                        content: ngaContentDecode(hotPost[post].content)
                    }]]
                }
                titlePage = { ...titlePage, ...{ hotPostList: hotPostList } }
            }
        } else if (allReply[result].subject !== '对主题发表了一条评论') {
            tempFloorReply = [...tempFloorReply, ...[{
                userName: allReply[result].author.username,
                registrationTime: moment(new Date(allReply[result].author.regdate * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                userMemberGroup: allReply[result].author.member,
                rvrc: allReply[result].author.rvrc,
                postCount: allReply[result].author.postnum,
                postContent: ngaContentDecode(allReply[result].content),
                postTime: moment(new Date(allReply[result].postdatetimestamp * 1000)).format('YYYY-MM-DD HH:mm:ss'),
                voteGood: allReply[result].vote_good,
                voteBad: allReply[result].vote_bad,
                floor: allReply[result].lou
            }]]
            replyPage[tempFloorReply[0].floor] = tempFloorReply[0]
        }
    }
    //获取标题和回复数
    let msgTitle = `NGA消息解析 ` + subject;
    let msgReply = `回复数 ` + replyCount;
    replyPage = { "reply": replyPage }

    //根据回复长度生成多张图片，包括主题和热评回复和贴条
    let splitPageCount = 0
    let replypics = []
    replypics.push(await renderCard(e, 'title', titlePage))
    let newReplyPage = []
    for (let pageCount in replyPage['reply']) {
        newReplyPage.push(replyPage['reply'][pageCount])
        splitPageCount++
        if (splitPageCount === 10) {
            replypics.push(await renderCard(e, 'reply', { "reply": newReplyPage }))
            newReplyPage = []
            splitPageCount = 0
        }
    }

    if (newReplyPage.length > 0) {
        replypics.push(await renderCard(e, 'reply', { "reply": newReplyPage }))
    }
    //let ngaUrl = `` || tid
    let ngaUrl = 'https://ngabbs.com/read.php?tid=' + tid

    //放在消息合并
    let sendMsg = msgCombine(ngaUrl, msgTitle, msgReply, replypics);
    let getCombineSendMsg = await common.replyMake(sendMsg, true, null);
    Bot.pickGroup(e.group_id)
        .sendMsg(getCombineSendMsg)
        .catch((err) => { // 推送失败，可能仅仅是某个群推送失败
            Bot.logger.mark(err)
            common.relpyPrivate(botConfig.masterQQ, `${pushID}群推送失败\n` + err + "\n" + msg)
            pushAgain(pushID, msg)
        })
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
    })
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
    })
}

function msgCombine(ngaUrl, title, reply, pics) {
    let msg
    msg = [title, reply, ngaUrl, pics]
    return msg
}

function msgAnalyse(e) {
    ngaContext(e)
}

function updateNgaAnalyse(e) {

}

async function ngaAnalyseTest(e) {
    e.msg = '';
    e.message = { data: `` }
    e.raw_message = '[json消息]'
    ngaContext(e)
}

async function ngaUrlPost(posturl, tid, pageCount) {
    let formData = new URLSearchParams()
    formData.append('tid', tid)
    formData.append('page', pageCount)

    //编一个RSS申请头，POST这个tid，获取所有data
    return await fetch(posturl, {
        method: "POST",
        headers: {
            'X-User-Agent': 'NGA_skull/6.0.5(iPhone10,3;iOS 12.0.1)',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
    }).then(res => res.json())
}

function ngaContentDecode(content) {
    content = `${content}`;
    let brReg = /<br\/>/g
    let imgReg = /\[img\].*\[\/img\]/g
    let emojiReg = /\[s\:.*:.*\]/g
    let colorReg = /<color.*<\/color>/g
    let replyReg = /<b>Reply to.*<\/b>/g
    if (content.match(brReg)) {
        content = content.replace(brReg, '\n')
    }
    if (content.match(emojiReg)) {
        content = ngaEmojiDecode(content.match(emojiReg), content)
    }
    if (content.match(imgReg)) {
        content = imgDecode(content.match(imgReg), content)
    }
    if (content.match(replyReg)) {
        content = replyDecode(content.match(replyReg), content)
    }

    return content
}

function ngaEmojiDecode(emoji, content) {
    let matchArray = emoji;
    matchArray.forEach(e => {
        let emojiArray = e.split(':')
        let emojiType = emojiArray[1].toString()
        let emojiName = emojiArray[2].toString()
        let path = '../../../../../plugins/bilibili-plugin/resources/nga/emoji/' + emojiType + '/' + emojiName.replace(']', '') + '.png'
        let replaceString = '<img src="' + path + '" />'
        content = content.replace(e, replaceString)
    });
    return content
}

function imgDecode(imgContent, content) {
    let matchArray = imgContent;
    matchArray.forEach(img => {
        let imgUrl = img.replace('[img]', '').replace('[/img]', '')
        let replaceString = '<img src="' + imgUrl + '" class="attachimg" />'
        content = content.replace(img, replaceString)
    });
    return content
}

function colorDecode() {

}

function replyDecode(replyContent, content) {
    let matchArray = replyContent
    matchArray.forEach(reply => {
        content = content.replace(reply, '')
    });
    return content
}

export default {
    msgAnalyse,
    updateNgaAnalyse,
    ngaAnalyseTest
}