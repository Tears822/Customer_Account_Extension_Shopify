const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please provide a valid authentication token' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'User not found or token is invalid' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'Token is malformed or invalid' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Authentication token has expired' 
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error during authentication' 
    });
  }
};

// Middleware to verify Shopify customer
const verifyShopifyCustomer = async (req, res, next) => {
  try {
    const shopifyCustomerId = req.headers['x-shopify-customer-id'];
    
    if (!shopifyCustomerId) {
      return res.status(400).json({ 
        error: 'Shopify customer ID required',
        message: 'Please provide Shopify customer ID' 
      });
    }

    // Verify customer exists in our database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('shopify_customer_id', shopifyCustomerId)
      .single();

    if (error || !user) {
      return res.status(404).json({ 
        error: 'Customer not found',
        message: 'Shopify customer not found in our system' 
      });
    }

    req.shopifyCustomer = user;
    next();
  } catch (error) {
    console.error('Shopify customer verification error:', error);
    return res.status(500).json({ 
      error: 'Customer verification error',
      message: 'Internal server error during customer verification' 
    });
  }
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = {
  authenticateToken,
  verifyShopifyCustomer,
  generateToken
}; 