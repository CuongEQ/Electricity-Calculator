/**
 * Vercel Serverless Function: /api/config
 * Đọc các biến môi trường được cấu hình an toàn trên Vercel Dashboard
 * và cung cấp cho ứng dụng web mà không lưu khóa trong mã nguồn GitHub.
 */

export default function handler(req, res) {
  // Chỉ cho phép GET request
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Caching nhẹ để tối ưu hiệu năng
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  };

  return res.status(200).json(config);
}
