const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

// Get current user
router.get('/me', async (req, res) => {
  try {
    const { user } = req;

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching user'
    });
  }
});

// Get user by ID (admin only)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { user: currentUser } = req;

    // Check if user is admin or requesting their own data
    if (currentUser.role !== 'admin' && currentUser.id !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own profile'
      });
    }

    const { data: user, error } = await supabase
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
        updated_at
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching user'
    });
  }
});

// Update current user
router.put('/me', async (req, res) => {
  try {
    const { user } = req;
    const { first_name, last_name, phone_number, birthdate, address } = req.body;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        phone_number,
        birthdate,
        address,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to update user'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while updating user'
    });
  }
});

// Get user's student profile
router.get('/me/student', async (req, res) => {
  try {
    const { user } = req;

    const { data: student, error } = await supabase
      .from('students')
      .select(`
        id,
        full_name,
        birthdate,
        phone_number,
        allergies,
        afflictions,
        emergency_contact_name,
        emergency_contact_phone,
        profile_picture_url,
        disclaimer_signed,
        fitness_level,
        fitness_goals,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching student profile:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch student profile'
      });
    }

    res.json({
      success: true,
      data: student || null
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching student profile'
    });
  }
});

// Create or update user's student profile
router.post('/me/student', async (req, res) => {
  try {
    const { user } = req;
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

    // Check if student profile exists
    let { data: existingStudent, error: checkError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let result;
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking student profile:', checkError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to check student profile'
      });
    }

    if (!existingStudent) {
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
        console.error('Error creating student profile:', createError);
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
        .eq('id', existingStudent.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating student profile:', updateError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to update student profile'
        });
      }

      result = updatedStudent;
    }

    res.json({
      success: true,
      message: existingStudent ? 'Student profile updated successfully' : 'Student profile created successfully',
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

module.exports = router; 