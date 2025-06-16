const mongoose = require('mongoose');
require('dotenv').config();

async function migrateUserFields() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // 获取 users 集合
    const db = mongoose.connection.db;
    const users = db.collection('users');

    // 更新所有用户文档
    const result = await users.updateMany(
      {}, // 匹配所有文档
      [
        {
          $addFields: {
            "user_name": "$username",
            "created_at": "$createdAt"
          }
        },
        {
          $unset: ["username", "createdAt"]
        }
      ]
    );

    console.log('Migration result:', result);
    console.log('Fields updated successfully');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

migrateUserFields(); 