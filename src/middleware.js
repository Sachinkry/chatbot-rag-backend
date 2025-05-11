const loggerMiddleware = (req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
  };
  
  const errorMiddleware = (err, req, res, next) => {
    console.error('Error:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ error: err.message || 'Something went wrong. Please try again.' });
  };
  
  module.exports = { loggerMiddleware, errorMiddleware };