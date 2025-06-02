<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/dist/index.css'
import axios from 'axios'

const imageList = ref([])
const translatedImages = ref([])
const isTranslating = ref(false)

const handleFileUpload = async (event) => {
  const files = event.target.files
  const formData = new FormData()

  for (let file of files) {
    if (!file.type.startsWith('image/')) {
      ElMessage.error('请只上传图片文件')
      continue
    }
    formData.append('images', file)

    const reader = new FileReader()
    reader.onload = (e) => {
      imageList.value.push({
        original: e.target.result,
        name: file.name,
        translated: null,
        status: 'pending' // pending, translating, done, error
      })
    }
    reader.readAsDataURL(file)
  }

  try {
    const response = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    if (response.data.success) {
      const files = response.data.files
      imageList.value = imageList.value.map((img, index) => ({
        ...img,
        path: files[index].path
      }))
      ElMessage.success('图片上传成功')
    }
  } catch (error) {
    ElMessage.error('图片上传失败：' + error.message)
  }
}

const startTranslation = async () => {
  if (imageList.value.length === 0) {
    ElMessage.warning('请先上传图片')
    return
  }

  isTranslating.value = true

  try {
    for (let image of imageList.value) {
      if (image.status === 'done') continue

      image.status = 'translating'
      const response = await axios.post('/api/translate', {
        imagePath: image.path
      })

      if (response.data.success) {
        // 从返回的数据中正确提取finalImageUrl
        image.translated = response.data.result.body.data.finalImageUrl
        image.status = 'done'
        translatedImages.value.push(image)
      } else {
        image.status = 'error'
        ElMessage.error(`翻译失败：${image.name}`)
      }
    }
    ElMessage.success('所有图片翻译完成')
  } catch (error) {
    ElMessage.error('翻译过程出错：' + error.message)
  } finally {
    isTranslating.value = false
  }
}

// 在文件顶部添加导入语句
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const downloadAllImages = async () => {
  if (translatedImages.value.length === 0) {
    ElMessage.warning('没有可下载的翻译图片')
    return
  }

  try {
    const zip = new JSZip()
    const promises = translatedImages.value.map(async (image, index) => {
      const response = await axios.get(image.translated, { responseType: 'arraybuffer' })
      zip.file(`translated-${index + 1}.jpg`, response.data)
    })

    await Promise.all(promises)
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, 'translated-images.zip')

    ElMessage.success('翻译后的图片已打包下载')
  } catch (error) {
    ElMessage.error('下载过程出错：' + error.message)
  }
}
</script>

<template>
  <div class="container">
    <h1>图片翻译工具</h1>
    
    <div class="upload-section">
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        @change="handleFileUpload"
        class="file-input"
      >
      <el-button 
        type="primary" 
        @click="startTranslation"
        :loading="isTranslating"
        :disabled="imageList.length === 0"
      >
        {{ isTranslating ? '翻译中...' : '开始翻译' }}
      </el-button>
      <el-button 
        type="success" 
        @click="downloadAllImages"
        :disabled="translatedImages.length === 0"
      >
        下载全部
      </el-button>
    </div>

    <div class="image-container">
      <div v-for="(image, index) in imageList" :key="index" class="image-pair">
        <div class="image-box">
          <h3>原始图片</h3>
          <img :src="image.original" :alt="image.name">
          <p class="status-text" :class="image.status">
            {{ 
              image.status === 'pending' ? '等待翻译' :
              image.status === 'translating' ? '翻译中...' :
              image.status === 'done' ? '翻译完成' :
              image.status === 'error' ? '翻译失败' : ''
            }}
          </p>
        </div>
        <div class="image-box" v-if="image.translated">
          <h3>翻译后</h3>
          <img :src="image.translated" :alt="'translated-' + image.name">
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.upload-section {
  margin: 20px 0;
  display: flex;
  gap: 10px;
  align-items: center;
}

.image-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-pair {
  display: flex;
  gap: 20px;
  justify-content: center;
}

.image-box {
  flex: 1;
  max-width: 500px;
}

.image-box img {
  width: 100%;
  height: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.file-input {
  padding: 10px;
}

.status-text {
  text-align: center;
  margin-top: 8px;
  font-size: 14px;
}

.status-text.pending {
  color: #909399;
}

.status-text.translating {
  color: #e6a23c;
}

.status-text.done {
  color: #67c23a;
}

.status-text.error {
  color: #f56c6c;
}
</style>
