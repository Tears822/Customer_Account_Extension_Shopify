const express = require('express');
const { supabase } = require('../config/supabase');
const { verifyShopifyCustomer } = require('../middleware/auth');

const router = express.Router();

// Get user's bookings
router.get('/', verifyShopifyCustomer, async (req, res) => {
  try {
    const { shopifyCustomer } = req;
    const { status = 'active', limit = 50, offset = 0 } = req.query;
    
    // Get student record for the user
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', shopifyCustomer.id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        error: 'Student profile not found',
        message: 'Please complete your student profile first'
      });
    }

    // Get bookings with session details
    let query = supabase
      .from('bookings')
      .select(`
        id,
        status,
        booking_time,
        cancelled_at,
        cancellation_reason,
        credit_refunded,
        check_in_time,
        notes,
        session:sessions(
          id,
          session_date,
          session_time,
          duration_minutes,
          class:classes(
            id,
            name,
            description,
            class_type:class_types(
              id,
              name,
              category,
              intensity_level
            ),
            room:rooms(
              id,
              name
            )
          ),
          instructor:instructors(
            id,
            user:users(
              id,
              first_name,
              last_name
            )
          )
        ),
        student_plan:student_plans(
          id,
          plan:plans(
            id,
            name
          )
        )
      `)
      .eq('student_id', student.id)
      .order('booking_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch bookings'
      });
    }

    res.json({
      success: true,
      data: bookings || [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: bookings?.length || 0
      }
    });
  } catch (error) {
    console.error('Error in bookings route:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching bookings'
    });
  }
});

// Create a new booking
router.post('/', verifyShopifyCustomer, async (req, res) => {
  try {
    const { shopifyCustomer } = req;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Session ID is required'
      });
    }

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', shopifyCustomer.id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        error: 'Student profile not found',
        message: 'Please complete your student profile first'
      });
    }

    // Check if user already has an active booking for this session
    const { data: existingBooking, error: existingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', student.id)
      .eq('session_id', session_id)
      .eq('status', 'active')
      .single();

    if (existingBooking) {
      return res.status(409).json({
        error: 'Already booked',
        message: 'You already have an active booking for this session'
      });
    }

    // Get session details and check availability
    const { data: session, error: sessionError } = await supabase
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
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The requested session does not exist'
      });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({
        error: 'Session not available',
        message: 'This session is not available for booking'
      });
    }

    if (session.spots_left <= 0) {
      return res.status(400).json({
        error: 'Session full',
        message: 'This session is full'
      });
    }

    // Check booking cutoff time
    const now = new Date();
    const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
    const cutoffTime = new Date(sessionDateTime.getTime() - (session.booking_cutoff_minutes * 60 * 1000));
    
    if (now >= cutoffTime) {
      return res.status(400).json({
        error: 'Booking closed',
        message: `Bookings close ${session.booking_cutoff_minutes} minutes before the session starts`
      });
    }

    // Get user's active plans with credits
    const { data: studentPlans, error: plansError } = await supabase
      .from('student_plans')
      .select(`
        id,
        remaining_credits,
        is_unlimited,
        plan:plans(
          id,
          name,
          credits
        )
      `)
      .eq('student_id', student.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (plansError) {
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch user plans'
      });
    }

    // Find a plan with available credits
    const availablePlan = studentPlans.find(plan => 
      plan.is_unlimited || plan.remaining_credits > 0
    );

    if (!availablePlan) {
      return res.status(400).json({
        error: 'No credits available',
        message: 'You need to purchase a class pack to book sessions'
      });
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        student_id: student.id,
        session_id: session_id,
        student_plan_id: availablePlan.id,
        status: 'active'
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to create booking'
      });
    }

    // Create credit transaction (debit)
    const { error: transactionError } = await supabase.rpc('create_credit_transaction', {
      p_student_plan_id: availablePlan.id,
      p_transaction_type: 'debit',
      p_amount: 1,
      p_reference_id: booking.id,
      p_reference_type: 'booking',
      p_description: `Booked session: ${session.session_date} at ${session.session_time}`
    });

    if (transactionError) {
      console.error('Error creating credit transaction:', transactionError);
      // Note: We don't fail the booking if transaction logging fails
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while creating booking'
    });
  }
});

// Cancel a booking
router.patch('/:bookingId/cancel', verifyShopifyCustomer, async (req, res) => {
  try {
    const { shopifyCustomer } = req;
    const { bookingId } = req.params;
    const { reason } = req.body;

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', shopifyCustomer.id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        error: 'Student profile not found',
        message: 'Please complete your student profile first'
      });
    }

    // Get booking with session details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        student_plan_id,
        session:sessions(
          id,
          session_date,
          session_time,
          cancellation_cutoff_hours,
          status
        )
      `)
      .eq('id', bookingId)
      .eq('student_id', student.id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        error: 'Booking not found',
        message: 'The requested booking does not exist'
      });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({
        error: 'Cannot cancel',
        message: 'This booking cannot be cancelled'
      });
    }

    // Check cancellation cutoff time
    const now = new Date();
    const sessionDateTime = new Date(`${booking.session.session_date}T${booking.session.session_time}`);
    const cancellationDeadline = new Date(sessionDateTime.getTime() - (booking.session.cancellation_cutoff_hours * 60 * 60 * 1000));
    
    if (now >= cancellationDeadline) {
      return res.status(400).json({
        error: 'Cancellation deadline passed',
        message: `Cancellations must be made at least ${booking.session.cancellation_cutoff_hours} hours before the session`
      });
    }

    // Update booking status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Cancelled by user'
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to cancel booking'
      });
    }

    // Create credit transaction (credit/refund)
    const { error: transactionError } = await supabase.rpc('create_credit_transaction', {
      p_student_plan_id: booking.student_plan_id,
      p_transaction_type: 'credit',
      p_amount: 1,
      p_reference_id: booking.id,
      p_reference_type: 'cancellation',
      p_description: `Cancelled session: ${booking.session.session_date} at ${booking.session.session_time}`
    });

    if (transactionError) {
      console.error('Error creating credit transaction:', transactionError);
      // Note: We don't fail the cancellation if transaction logging fails
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully. Credit has been refunded to your account.',
      data: updatedBooking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while cancelling booking'
    });
  }
});

// Get booking by ID
router.get('/:bookingId', verifyShopifyCustomer, async (req, res) => {
  try {
    const { shopifyCustomer } = req;
    const { bookingId } = req.params;

    // Get student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', shopifyCustomer.id)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        error: 'Student profile not found',
        message: 'Please complete your student profile first'
      });
    }

    // Get booking details
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        booking_time,
        cancelled_at,
        cancellation_reason,
        credit_refunded,
        check_in_time,
        notes,
        session:sessions(
          id,
          session_date,
          session_time,
          duration_minutes,
          class:classes(
            id,
            name,
            description,
            class_type:class_types(
              id,
              name,
              category,
              intensity_level
            ),
            room:rooms(
              id,
              name
            )
          ),
          instructor:instructors(
            id,
            user:users(
              id,
              first_name,
              last_name
            )
          )
        ),
        student_plan:student_plans(
          id,
          plan:plans(
            id,
            name
          )
        )
      `)
      .eq('id', bookingId)
      .eq('student_id', student.id)
      .single();

    if (error || !booking) {
      return res.status(404).json({
        error: 'Booking not found',
        message: 'The requested booking does not exist'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Internal server error while fetching booking'
    });
  }
});

module.exports = router; 