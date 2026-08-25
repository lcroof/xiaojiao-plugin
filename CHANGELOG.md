# 1.3.2
* B站/NGA解析图片背景改为平铺显示，不再拉伸；平铺时偶数行上下镜像，接缝无缝
* B站/NGA接口请求失败自动重试

# 1.3.1
* B站直播分享消息不再解析，直接跳过
* 修复B站定时发布视频显示时间为稿件创建时间的问题，改为显示定时发布时间

# 1.3.0
* NGA解析改为使用账号登录态获取帖子内容，新增 #NGA登录ck Cookie 命令设置登录Cookie（保存于 data/PushNews/NgaCookies.yaml）
* NGA解析测试支持直接指定tid：NGA解析测试 12345678
* 实现 (开启|关闭)视频解析 与 (开启|关闭)NGA链接解析 开关（主人/群管理可操作，配置保存于 data/PushNews/AnalyseConfig.json）
* 重新启用B站视频解析入口；B站解析测试支持指定BV号：B站解析测试 BV1xxxxxx
* 新增 #B站登录ck Cookie 命令设置B站登录Cookie（保存于 data/PushNews/BilibiliCookies.yaml），并修复原 #B站推送ck 误存整条消息的问题
* 新增帮助面板：#帮助 / #小脚帮助 / #B站帮助，可复制 resources/help/help-cfg_default.js 为 help-cfg.js 自定义
* 新增版本更新日志面板：#版本 / #小脚版本
* 新增 guoba.support.js，支持锅巴插件（guoba-plugin）可视化配置：B站/NGA解析开关、B站推送间隔/过期时间/推送方式
* 整理 bilibili/biliPush 组件：推送相关代码全部收敛到 biliPush.js，bilibili.js 只保留视频解析与Cookie设定，消除重复的配置加载逻辑
* 修复B站解析封面图/头像因网络未加载完而显示不全的问题（提前下载为base64内嵌，并固定图片宽高）
* 修复 biliAnalyse 直接改写全局请求头 common.BiliReqHeaders 的隐患（改为复制副本）
* 修复 getBilibiliPushUserList 引用不存在的 biliPush.biliUserList 导致的报错
* 补上 (开启|关闭)B站推送 命令入口，移除指向不存在方法的坏规则；B站解析测试改为使用标准BV正则
* 修复B站分享卡片/短链（b23.tv）无法触发解析的问题
* B站视频卡片简介排版优化：保留原始换行（pre-wrap）、长链接自动断行、统一换行符并限长400字
* 修复QQ小程序分享卡（URL 带 \/ 转义斜杠，如 qqdocurl）无法触发B站解析的问题：规则正则兼容可选反斜杠

# 1.2.0
* 修复一些IOS卡片无法识别的BUG
* 修复B站动态改版后没有纯文字的动态类型

# 1.1.0
* NGA链接解析

# 1.0.0
* B站推送和B站视频解析