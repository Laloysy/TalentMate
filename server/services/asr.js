/**
 * Tencent Cloud ASR (Automatic Speech Recognition) Service.
 * Uses the "SentenceRecognition" API for one-sentence recognition.
 * SDK docs: https://cloud.tencent.com/document/product/1093/35646
 */
const tencentcloud = require('tencentcloud-sdk-nodejs');
const fs = require('fs');

const AsrClient = tencentcloud.asr.v20190614.Client;

const client = new AsrClient({
  credential: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  region: 'ap-guangzhou',
  profile: {
    httpProfile: { endpoint: 'asr.tencentcloudapi.com' },
  },
});

const path = require('path');

// Detect ASR-compatible VoiceFormat from file extension
function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.wav': 'wav', '.pcm': 'pcm', '.ogg': 'ogg-opus',
    '.mp3': 'mp3', '.m4a': 'm4a', '.aac': 'aac',
    '.webm': 'ogg-opus', // webm uses opus codec
  };
  return map[ext] || 'wav';
}

/**
 * Recognize speech from an audio file.
 * @param {string} audioPath - Absolute path to the audio file
 * @returns {Promise<string>} - Recognized text
 */
async function recognize(audioPath) {
  const audioBuffer = fs.readFileSync(audioPath);
  const audioBase64 = audioBuffer.toString('base64');

  const params = {
    EngSerViceType: '16k_zh',
    SourceType: 1,
    VoiceFormat: detectFormat(audioPath),
    Data: audioBase64,
    DataLen: audioBuffer.length,
  };

  const response = await client.SentenceRecognition(params);
  return response.Result || '';
}

module.exports = { recognize };
