const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  user_name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, { id: false });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.user_id = ret._id;
    delete ret._id;
    delete ret.id;
    delete ret.password;
    return {
      user_id: ret.user_id,
      user_name: ret.user_name,
      role: ret.role,
      created_at: ret.created_at
    };
  },
  versionKey: false
});

module.exports = mongoose.model('User', userSchema); 