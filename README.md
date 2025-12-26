域名：puhui.ai
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

代码生成Google AI Studio，名字叫做“普會AI”，是给用户提供可视化数据生成、图片生成、AI 聊天的一个应用。
View your app in AI Studio: https://ai.studio/apps/drive/1rUMiI9sBTgH9JtkXs6mHWL58Po1t5Sck
部署在railway，
这个项目的用户数据在aiven，图片等对象存储放在cloudflare R2
github:  lorsso/Vision4avcf

这个项目在初版时，每次重新部署都会清空数据库。

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
