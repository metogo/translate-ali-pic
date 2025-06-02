const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 创建阿里云翻译客户端
const alimt20181012 = require('@alicloud/alimt20181012');
const OpenApi = require('@alicloud/openapi-client');
const Credential = require('@alicloud/credentials');

function createClient() {
  const credential = new Credential.Config({
    type: 'access_key',
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  });
  const config = new OpenApi.Config({
    credential: new Credential.default(credential),
  });
  // 设置访问域名
  config.endpoint = 'mt.cn-hangzhou.aliyuncs.com';
  // 设置超时时间（毫秒）
  config.connectTimeout = 15000; // 连接超时 10 秒
  config.readTimeout = 30000;    // 读取超时 30 秒
  // 设置重试次数
  config.maxAttempts = 3;        // 最多重试 3 次
  return new alimt20181012.default(config);
}

// 上传图片接口
app.post('/api/upload', upload.array('images'), (req, res) => {
  try {
    const files = req.files;
    console.log(`[${new Date().toISOString()}] 收到上传请求，文件数量: ${files.length}`);
    
    const fileUrls = files.map(file => {
      console.log(`[${new Date().toISOString()}] 处理文件: ${file.originalname}`);
      return {
        path: file.path,
        name: file.originalname
      }
    });
    
    console.log(`[${new Date().toISOString()}] 文件上传成功`);
    res.json({ success: true, files: fileUrls });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 上传失败:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 翻译图片接口
app.post('/api/translate', async (req, res) => {
  try {
    const { imagePath, sourceLanguage, targetLanguage } = req.body;
    console.log(`[${new Date().toISOString()}] 开始翻译图片: ${imagePath}, 源语言: ${sourceLanguage}, 目标语言: ${targetLanguage}`);
    
    const client = createClient();
    console.log(`[${new Date().toISOString()}] 阿里云客户端创建成功`);
    
    // 读取图片文件并转换为 Base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    console.log(`[${new Date().toISOString()}] 图片转换为Base64完成`);

    const translateRequest = new alimt20181012.TranslateImageRequest({
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      imageBase64: base64Image,
    });

    console.log(`[${new Date().toISOString()}] 发送翻译请求...`);
    const result = await client.translateImage(translateRequest);
    console.log(`[${new Date().toISOString()}] 翻译完成`);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 翻译失败:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] 服务器启动成功，监听端口 ${PORT}`);
  console.log(`[${new Date().toISOString()}] 环境变量检查:`);
  console.log(`[${new Date().toISOString()}] - AccessKey ID: ${process.env.ALIBABA_CLOUD_ACCESS_KEY_ID ? '已设置' : '未设置'}`);
  console.log(`[${new Date().toISOString()}] - AccessKey Secret: ${process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ? '已设置' : '未设置'}`);
});