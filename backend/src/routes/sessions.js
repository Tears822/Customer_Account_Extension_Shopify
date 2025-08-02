const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

// Get available sessions with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      date, 
      class_type, 
      instructor_id, 
      limit = 50,
      offset = 0 
    } = req.query;

    let query = supabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        duration_minutes,
        capacity,
        spots_taken,
        spots_left,
        booking_cutoff_minutes,
        cancellation_cutoff_hours,
        status,
        notes,
        class:classes(
          id,
          name,
          description,
          day_of_week,
          time,
          duration_minutes,
          capacity,
          class_type:class_types(
            id,
            name,
            description,
            category,
            intensity_level,
            color_code
          ),
          room:rooms(
            id,
            name,
            capacity,
            description
          )
        ),
        instructor:instructors(
          id,
          bio,
          certifications,
          specialties,
          user:users(
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq('status', 'scheduled')
      .gte('session_date', new Date().toISOString().split('T')[0])
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (date) {
      query = query.eq('session_date', date);
    }

    if (class_type) {
      query = query.eq('class.class_type.category', class_type);
    }

    if (instructor_id) {
      query = query.eq('instructor_id', instructor_id);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch sessions'
      });
    }

    // Filter out sessions that are past booking cutoff
    const now = new Date();
    const filteredSessions = sessions.filter(session => {
      const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
      const cutoffTime = new Date(sessionDateTime.getTime() - (session.booking_cutoff_minutes * 60 * 1000));
      return now < cutoffTime;
    });

    res.json({
      success: true,
      data: filteredSessions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: filteredSessions.length
      }
    });
  } catch (error) {
    console.error('Error in sessions route:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching sessions'
    });
  }
});

// Get session by ID
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { data: session, error } = await supabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        duration_minutes,
        capacity,
        spots_taken,
        spots_left,
        booking_cutoff_minutes,
        cancellation_cutoff_hours,
        status,
        notes,
        class:classes(
          id,
          name,
          description,
          day_of_week,
          time,
          duration_minutes,
          capacity,
          class_type:class_types(
            id,
            name,
            description,
            category,
            intensity_level,
            color_code
          ),
          room:rooms(
            id,
            name,
            capacity,
            description
          )
        ),
        instructor:instructors(
          id,
          bio,
          certifications,
          specialties,
          user:users(
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The requested session does not exist'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching session'
    });
  }
});

// Get class types for filtering
router.get('/class-types/list', async (req, res) => {
  try {
    const { data: classTypes, error } = await supabase
      .from('class_types')
      .select('id, name, description, category, intensity_level, color_code')
      .order('name');

    if (error) {
      console.error('Error fetching class types:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch class types'
      });
    }

    res.json({
      success: true,
      data: classTypes || []
    });
  } catch (error) {
    console.error('Error in class-types route:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching class types'
    });
  }
});

// Get instructors list
router.get('/instructors/list', async (req, res) => {
  try {
    const { data: instructors, error } = await supabase
      .from('instructors')
      .select(`
        id,
        bio,
        specialties,
        user:users(
          id,
          first_name,
          last_name
        )
      `)
      .eq('is_active', true)
      .order('user.first_name');

    if (error) {
      console.error('Error fetching instructors:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch instructors'
      });
    }

    res.json({
      success: true,
      data: instructors || []
    });
  } catch (error) {
    console.error('Error in instructors route:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching instructors'
    });
  }
});

// Check session availability
router.get('/:sessionId/availability', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { data: session, error } = await supabase
      .from('sessions')
      .select(`
        id,
        session_date,
        session_time,
        capacity,
        spots_taken,
        spots_left,
        booking_cutoff_minutes,
        status
      `)
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The requested session does not exist'
      });
    }

    // Check if booking is still allowed
    const now = new Date();
    const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
    const cutoffTime = new Date(sessionDateTime.getTime() - (session.booking_cutoff_minutes * 60 * 1000));
    const canBook = now < cutoffTime;

    res.json({
      success: true,
      data: {
        session_id: session.id,
        available_spots: session.spots_left,
        can_book: canBook && session.status === 'scheduled',
        booking_cutoff: cutoffTime,
        session_datetime: sessionDateTime
      }
    });
  } catch (error) {
    console.error('Error checking session availability:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while checking availability'
    });
  }
});

module.exports = router; 