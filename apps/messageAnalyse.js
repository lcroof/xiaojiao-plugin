import { rulePrefix } from '../utils/common.js'
import bili from "../components/bilibili.js"
import nga from "../components/nga.js"


export class MessageAnalyse extends plugin {
    constructor(e) {
        super({
            name: '解析面板',
            dsc: '贴片界面消息解析',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: `^#?(开启|关闭)视频解析$`,
                    fnc: 'updateBiliAnalyse'
                },
                {
                    reg: `^#?(开启|关闭)NGA链接解析$`,
                    fnc: 'updateNgaAnalyse'
                },
                {
                    reg: /(b23\.tv\\?\/[A-Za-z0-9]+|bilibili\.com\\?\/[A-Za-z0-9\-_?&=.\/]+)/,
                    fnc: 'biliMsgAnalyse'
                },
                {
                    // 兼容 json 卡片里转义斜杠的链接，覆盖 ngabbs.com / bbs.nga.cn / nga.178.com
                    reg: /(ngabbs\.com|bbs\.nga|nga\.178).*tid\=[0-9]+/,
                    fnc: 'ngaMsgAnalyse'
                },
                {
                    reg: `^#?NGA(登录)?(ck|cookie)\\s*.*$`,
                    fnc: 'setNgaCookie'
                },
                {
                    reg: `^#?(B站|b站)(登录)?(ck|cookie)\\s*.*$`,
                    fnc: 'setBiliCookie'
                },
                {
                    reg: `B站解析测试`,
                    fnc: 'biliMsgAnalyseTest'
                },
                {
                    reg: `NGA解析测试`,
                    fnc: 'ngaMsgAnalyseTest'
                }
            ]
        })
    }

    /**
       * 修改bv解析
       * @param {*} e 
       * @returns 
       */
    async updateBiliAnalyse(e) {
        bili.updateBvAnalyse(e);
    }

    /**
       * 修改nga解析
       * @param {*} e 
       * @returns 
       */
    async updateNgaAnalyse(e) {
        nga.updateNgaAnalyse(e);
    }

    /**
     * bili消息解析
     * @param {*} e 
     */
    async biliMsgAnalyse(e) {
        bili.msgAnalyse(e);        
    }

    /**
     * nga消息解析
     * @param {*} e 
     */
    async ngaMsgAnalyse(e) {
        nga.msgAnalyse(e);        
    }

    /**
     * bili消息解析测试
     * @param {*} e 
     */
    async biliMsgAnalyseTest(e) {
        bili.biliAnalyseTest(e);        
    }

    /**
     * nga消息解析测试
     * @param {*} e 
     */
    async ngaMsgAnalyseTest(e) {
        nga.ngaAnalyseTest(e);        
    }

    /**
     * 设置NGA登录Cookie
     * @param {*} e 
     */
    async setNgaCookie(e) {
        nga.setNgaCookie(e)
    }

    /**
     * 设置B站登录Cookie
     * @param {*} e 
     */
    async setBiliCookie(e) {
        bili.setBiliCookie(e)
    }
}