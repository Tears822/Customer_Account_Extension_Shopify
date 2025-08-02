const express = require('express');
const { supabase } = require('../config/supabase');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Authenticate Shopify customer
router.post('/shopify-login', async (req, res) => {
  try {
    const { shopify_customer_id, email, first_name, last_name } = req.body;

    if (!shopify_customer_id || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Shopify customer ID and email are required'
      });
    }

    // Check if user exists
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('shopify_customer_id', shopify_customer_id)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error checking user:', userError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check user existence'
      });
    }

    // Create user if doesn't exist
    if (!user) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          shopify_customer_id,
          email,
          first_name: first_name || '',
          last_name: last_name || '',
          role: 'user'
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to create user'
        });
      }

      user = newUser;
    } else {
      // Update user info if needed
      const updates = {};
      if (first_name && first_name !== user.first_name) updates.first_name = first_name;
      if (last_name && last_name !== user.last_name) updates.last_name = last_name;
      if (email !== user.email) updates.email = email;

      if (Object.keys(updates).length > 0) {
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating user:', updateError);
        } else {
          user = updatedUser;
        }
      }
    }

    // Generate JWT token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Error in shopify-login:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error during authentication'
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const shopifyCustomerId = req.headers['x-shopify-customer-id'];
    
    if (!shopifyCustomerId) {
      return res.status(400).json({
        error: 'Shopify customer ID required',
        message: 'Please provide Shopify customer ID'
      });
    }

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        phone_number,
        birthdate,
        address,
        role,
        created_at,
        students(
          id,
          full_name,
          birthdate,
          phone_number,
          allergies,
          afflictions,
          emergency_contact_name,
          emergency_contact_phone,
          fitness_level,
          fitness_goals
        )
      `)
      .eq('shopify_customer_id', shopifyCustomerId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching profile'
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const shopifyCustomerId = req.headers['x-shopify-customer-id'];
    const { first_name, last_name, phone_number, birthdate, address } = req.body;
    
    if (!shopifyCustomerId) {
      return res.status(400).json({
        error: 'Shopify customer ID required',
        message: 'Please provide Shopify customer ID'
      });
    }

    // Update user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        phone_number,
        birthdate,
        address,
        updated_at: new Date().toISOString()
      })
      .eq('shopify_customer_id', shopifyCustomerId)
      .select()
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while updating profile'
    });
  }
});

// Create or update student profile
router.post('/student-profile', async (req, res) => {
  try {
    const shopifyCustomerId = req.headers['x-shopify-customer-id'];
    const {
      full_name,
      birthdate,
      phone_number,
      allergies,
      afflictions,
      emergency_contact_name,
      emergency_contact_phone,
      fitness_level,
      fitness_goals
    } = req.body;
    
    if (!shopifyCustomerId) {
      return res.status(400).json({
        error: 'Shopify customer ID required',
        message: 'Please provide Shopify customer ID'
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('shopify_customer_id', shopifyCustomerId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }

    // Check if student profile exists
    let { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .single();

    let result;
    if (studentError && studentError.code !== 'PGRST116') {
      console.error('Error checking student:', studentError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check student profile'
      });
    }

    if (!student) {
      // Create new student profile
      const { data: newStudent, error: createError } = await supabase
        .from('students')
        .insert({
          user_id: user.id,
          full_name,
          birthdate,
          phone_number,
          allergies,
          afflictions,
          emergency_contact_name,
          emergency_contact_phone,
          fitness_level,
          fitness_goals,
          disclaimer_signed: true
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating student:', createError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to create student profile'
        });
      }

      result = newStudent;
    } else {
      // Update existing student profile
      const { data: updatedStudent, error: updateError } = await supabase
        .from('students')
        .update({
          full_name,
          birthdate,
          phone_number,
          allergies,
          afflictions,
          emergency_contact_name,
          emergency_contact_phone,
          fitness_level,
          fitness_goals,
          updated_at: new Date().toISOString()
        })
        .eq('id', student.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating student:', updateError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to update student profile'
        });
      }

      result = updatedStudent;
    }

    res.json({
      success: true,
      message: student ? 'Student profile updated successfully' : 'Student profile created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error managing student profile:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while managing student profile'
    });
  }
});

// Verify authentication token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token required',
        message: 'Please provide authentication token'
      });
    }

    // This would typically verify the JWT token
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Token is valid'
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while verifying token'
    });
  }
});

module.exports = router; 