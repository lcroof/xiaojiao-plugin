/*
* 请勿直接修改此文件，可能会导致后续更新冲突
* 如需自定义可将文件复制一份，重命名为 help-cfg.js 后编辑
* */

// 帮助配置
export const helpCfg = {
  title: "小脚插件",  // 帮助标题
  subTitle: "Yunzai-Bot & xiaojiao-plugin" // 帮助副标题
};

export const helpList = [{
	"group": "B站功能",
	"list": [{
			"icon": "📺",
			"title": "#开启视频解析 / #关闭视频解析",
			"desc": "B站视频链接解析开关（主人/群管理）"
		},
		{
			"icon": "🎬",
			"title": "B站解析测试 BV1xxxxxx",
			"desc": "测试B站视频解析"
		},
		{
			"icon": "🍪",
			"title": "#B站登录ck Cookie",
			"desc": "设置B站登录Cookie（主人）"
		},
		{
			"icon": "🔔",
			"title": "#B站订阅推送 UID",
			"desc": "订阅B站UP主动态推送"
		},
		{
			"icon": "📋",
			"title": "#B站推送列表",
			"desc": "查看B站推送开启状态"
		},
		{
			"icon": "🖼️",
			"title": "#B站设置推送(默认|合并|图片)",
			"desc": "设置B站动态推送方式"
		},
		{
			"icon": "⏰",
			"title": "#B站推送时间 10",
			"desc": "设置推送间隔，单位分钟（主人）"
		},
		{
			"icon": "⌛",
			"title": "#B站推送过期时间 1",
			"desc": "设置动态推送过期小时（主人）"
		},
		{
			"icon": "🍪",
			"title": "#B站推送ck Cookie",
			"desc": "设置B站推送Cookie（主人）"
		},
		{
			"icon": "⬆️",
			"title": "#B站更新",
			"desc": "更新插件本体（主人）"
		}
	]
}, {
	"group": "NGA功能",
	"list": [{
			"icon": "🌐",
			"title": "发送NGA帖子链接",
			"desc": "自动解析帖子内容，展示高赞与贴条"
		},
		{
			"icon": "🍪",
			"title": "#NGA登录ck Cookie",
			"desc": "设置NGA登录Cookie，以账号登录态获取内容（主人）"
		},
		{
			"icon": "🧪",
			"title": "NGA解析测试 tid",
			"desc": "测试NGA帖子解析"
		},
		{
			"icon": "⚙️",
			"title": "#开启NGA链接解析 / #关闭NGA链接解析",
			"desc": "NGA链接解析开关（主人/群管理）"
		}
	]
}, {
	"group": "其他",
	"list": [{
			"icon": "❓",
			"title": "#帮助 / #小脚帮助",
			"desc": "查看本插件帮助"
		},
		{
			"icon": "📄",
			"title": "#版本 / #小脚版本",
			"desc": "查看插件版本与更新记录"
		}
	]
}]
