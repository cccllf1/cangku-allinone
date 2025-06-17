const { getMessage } = require('../utils/i18n');

module.exports = function i18nMiddleware(req, res, next) {
  const lang = (req.headers['accept-language'] || 'zh-CN').split(',')[0];

  res.sendResponse = function({ success = true, data = null, error_code = null, error_message = null, ...rest }) {
    if (!success && error_code && !error_message) {
      error_message = getMessage(error_code, lang);
    }
    res.json({ success, data, error_code, error_message, ...rest });
  };

  next();
}; 