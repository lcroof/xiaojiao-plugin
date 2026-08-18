import common from "../common/commonFunction.js";
import runtimeRender from '../common/runtimeRender.js'
import { botConfig } from "../common/commonFunction.js"
import moment from "moment";
import fetch from "node-fetch";

async function ngaContext(e, isTest = false) {
    let msg = e.msg;
    let titlePage = {}
    let replyPage = {}
    let allReply = []

    //解析开关关闭时不处理（测试命令不受影响）
    if (!isTest && !common.isAnalyseEnabled("nga")) {
        return false
    }

    if (e.raw_message == '[json消息]') {
        let json = JSON.parse(e.message[0]?.data || '{}')
        msg = msg || json?.meta?.detail_1?.qqdocurl || json?.meta?.news?.jumpUrl
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
    let postInfo
    try {
        postInfo = await ngaUrlPost(postUrl, tid, 1)
    } catch (err) {
        e.reply(`获取主题内容失败：${err.message}`)
        return false
    }

    if (postInfo.code !== 0) {
        e.reply(ngaErrorMsg(postInfo, '未获取到主题内容'))
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

    ;(postResult || []).forEach(result => {
        allReply.push(result)
    });


    try {
        while (totalPage >= currentPage + 1) {
            postInfo = await ngaUrlPost(postUrl, tid, currentPage + 1)
            currentPage = postInfo.currentPage
            ;(postInfo.result || []).forEach(result => {
                allReply.push(result)
            });
        }
    } catch (err) {
        e.reply(`获取后续楼层失败：${err.message}`)
        return false
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
            titlePage = {
                ...titlePage, ...{
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
                }
            }
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
    let msgTitle = subject;
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

    let ngaUrl = `` || tid
    if (!process.argv.includes('dev')) {
        ngaUrl = 'https://ngabbs.com/read.php?tid=' + tid
    }

    //放在消息合并
    e.reply(subject)
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
    return ngaContext(e)
}

/**
 * 开启|关闭NGA链接解析
 * @param {*} e 
 */
function updateNgaAnalyse(e) {
    if (!common.adminAllow(e)) {
        return false
    }
    if (e.msg.includes("开启")) {
        common.setAnalyseEnabled("nga", true)
        e.reply("NGA链接解析已开启~")
    }
    if (e.msg.includes("关闭")) {
        common.setAnalyseEnabled("nga", false)
        e.reply("NGA链接解析已关闭~")
    }
}

/**
 * NGA解析测试
 * 示例：NGA解析测试 12345678 或 NGA解析测试 https://ngabbs.com/read.php?tid=12345678
 * @param {*} e 
 */
async function ngaAnalyseTest(e) {
    let testTid = (e.msg.match(/tid\=?\s*([0-9]+)/) || [])[1]
    if (!testTid) {
        e.reply("示例：NGA解析测试 12345678 或 NGA解析测试 https://ngabbs.com/read.php?tid=12345678")
        return false
    }
    e.msg = `https://ngabbs.com/read.php?tid=${testTid}`
    e.message = []
    e.raw_message = e.msg
    return ngaContext(e, true)
}

/**
 * 设置NGA登录Cookie（仅主人可操作）
 * Cookie获取方式：浏览器登录 https://ngabbs.com 后，打开开发者工具复制登录Cookie
 * （至少包含 ngaPassportUid 与 ngaPassportCid）
 * @param {*} e 
 */
function setNgaCookie(e) {
    if (!e.isMaster) {
        e.reply("哒咩，只有主人可以设置NGA登录Cookie哦")
        return false
    }
    let ck = e.msg.split(' ').slice(1).join(' ').trim()
    if (!ck) {
        e.reply("Cookie呢？我那么大个Cookie呢？\n示例：#NGA登录ck ngaPassportUid=xxx; ngaPassportCid=xxx")
        return false
    }
    common.saveData("NgaCookies", ck, "yaml")
    e.reply("NGA登录Cookie设置成功\n之后解析NGA帖子时会以该账号的登录态获取内容~")
    return true
}

/**
 * 读取NGA登录Cookie，未设置时返回空字符串
 */
function getNgaCookies() {
    let ck = common.readData("NgaCookies", "yaml")
    return ck ? ck.toString().trim() : ""
}

/**
 * 拼接NGA接口错误提示，登录相关错误额外提示如何设置Cookie
 * @param {*} postInfo 
 * @param {string} defaultMsg 
 */
function ngaErrorMsg(postInfo, defaultMsg) {
    let errMsg = postInfo?.error || postInfo?.message || defaultMsg
    if (postInfo?.code === -1 || /登录|login/i.test(errMsg)) {
        return `${errMsg}\n该内容需要NGA账号登录后才能获取\n可让主人发送 #NGA登录ck Cookie 设置登录态`
    }
    return errMsg
}

/**
 * 以账号登录态请求NGA接口（读取帖子内容）
 * @param {string} posturl 接口地址
 * @param {string} tid 帖子id
 * @param {number} pageCount 页码
 */
async function ngaUrlPost(posturl, tid, pageCount) {
    let formData = new URLSearchParams()
    formData.append('tid', tid)
    formData.append('page', pageCount)

    let headers = {
        'X-User-Agent': 'NGA_skull/6.0.5(iPhone10,3;iOS 12.0.1)',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    // 带上账号登录态（Cookie），以登录用户身份获取帖子内容
    let ngaCookies = getNgaCookies()
    if (ngaCookies) {
        headers.cookie = ngaCookies
    }

    //编一个RSS申请头，POST这个tid，获取所有data
    let res = await fetch(posturl, {
        method: "POST",
        headers: headers,
        body: formData.toString()
    })
    if (!res.ok) {
        throw new Error(`NGA接口请求失败 HTTP ${res.status} ${res.statusText}`)
    }
    return await res.json()
}

function ngaContentDecode(content) {
    content = `${content}`;
    let brReg = /<br\/>/g
    let imgReg = /\[img\].*\[\/img\]/g
    let emojiReg = /\[s\:.*:.*\]/g
    let replyReg = /<b>Reply to.*<\/b>/g
    let quoteReg = /\[quote\].*\[\/quote\]/g
    if (content.match(replyReg)) {
        content = replyDecode(content.match(replyReg), content)
    }
    if (content.match(quoteReg)) {
        content = quoteDecode(content.match(quoteReg), content)
    }
    if (content.match(imgReg)) {
        content = imgDecode(content.match(imgReg), content)
    }
    if (content.match(emojiReg)) {
        content = ngaEmojiDecode(content.match(emojiReg), content)
    }
    if (content.match(brReg)) {
        content = content.replace(brReg, '\n')
    }

    return content
}

function ngaEmojiDecode(emoji, content) {
    let matchArray = String(emoji).replace(/\]/g, '],').split(',');
    matchArray.forEach(e => {
        if (e !== '') {
            let emojiArray = e.split(':')
            if (emojiArray[1] === undefined) {
                Bot.logger.mark(e)
                Bot.logger.mark(content)
            }
            let emojiType = emojiArray[1].toString()            
            let emojiName = emojiArray[2].toString()
            let path = '../../../../../plugins/xiaojiao-plugin/resources/nga/emoji/' + emojiType.replace('[', '') + '/' + emojiName.replace(']', '') + '.png'
            let replaceString = '<img src="' + path + '" />'
            content = content.replace(e, replaceString)
        }
    });
    return content
}

function imgDecode(imgContent, content) {
    let matchArray = String(imgContent).replace(/\[\/img\]/g, '[/img],').split(',');
    matchArray.forEach(img => {
        if (img !== '') {
            let imgUrl = img.replace('[img]', '').replace('[/img]', '')
            let replaceString = '<img src="' + imgUrl + '" class="attachimg" />'
            content = content.replace(img, replaceString)
        }
    });
    return content
}

function quoteDecode(quoteContent, content) {
    let matchArray = String(quoteContent).replace(/\[\/quote\]/g, '[/quote];').split(';');
    matchArray.forEach(quote => {
        let actualQuoteContent = quote.replace('[quote]', '').replace('[/quote]', '').replace(/\[pid.*\[\/pid\]/g, '')
        let topicQuote = /\[tid.*\[\/tid\]/g
        let replaceString = '<div class="quote"><pre>' + actualQuoteContent + '</pre></div> \n'
        if (actualQuoteContent.match(topicQuote)) {
            replaceString = '<div class="quote"><pre>' + 'Topic Reply' + '</pre></div> \n'
        }
        content = content.replace(quote, replaceString)
    });
    return content
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
    ngaAnalyseTest,
    setNgaCookie
}