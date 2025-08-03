import supabase from '../config/supabase';

// Helper function to find or create user from Shopify customer
const findOrCreateUser = async (shopifyCustomer) => {
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('shopify_customer_id', shopifyCustomer.id.toString())
    .single();

  if (existingUser) {
    return existingUser;
  }

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      shopify_customer_id: shopifyCustomer.id.toString(),
      email: shopifyCustomer.email,
      first_name: shopifyCustomer.firstName || '',
      last_name: shopifyCustomer.lastName || '',
      role: 'user',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw new Error('Failed to create user');
  }

  return newUser;
};

// Helper function to find or create student profile
const findOrCreateStudent = async (user) => {
  const { data: existingStudent } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (existingStudent) {
    return existingStudent;
  }

  const { data: newStudent, error } = await supabase
    .from('students')
    .insert({
      user_id: user.id,
      full_name: `${user.first_name} ${user.last_name}`.trim(),
      birthdate: '1990-01-01', // Default - user will update
      phone_number: null,
      disclaimer_signed: false,
      fitness_level: 'beginner'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating student:', error);
    throw new Error('Failed to create student profile');
  }

  return newStudent;
};

// API Service Class
class ApiService {
  constructor() {
    this.user = null;
    this.student = null;
  }

  // Initialize user and student data
  async initialize(customer) {
    try {
      this.user = await findOrCreateUser(customer);
      this.student = await findOrCreateStudent(this.user);
      return { user: this.user, student: this.student };
    } catch (error) {
      console.error('Error initializing user:', error);
      throw error;
    }
  }

  // Get user plans (active student plans with expiration check)
  async getUserPlans() {
    if (!this.student) throw new Error('Student not initialized');

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('student_plans')
      .select(`
        *,
        plans (*),
        plan_purchases (
          *,
          users (first_name, last_name)
        )
      `)
      .eq('student_id', this.student.id)
      .eq('status', 'active')
      .gte('end_date', today) // Only plans that haven't expired
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user plans:', error);
      throw error;
    }

    return data || [];
  }

  // Get all sessions with class and instructor details
  async getSessions() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        classes (
          *,
          class_types (*),
          rooms (*)
        ),
        instructors (
          *,
          users (first_name, last_name)
        )
      `)
      .eq('status', 'scheduled')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true });

    if (error) {
      console.error('Error fetching sessions:', error);
      throw error;
    }

    return data || [];
  }

  // Get user bookings with session details
  async getBookings() {
    if (!this.student) throw new Error('Student not initialized');

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        sessions (
          *,
          classes (
            *,
            class_types (*),
            rooms (*)
          ),
          instructors (
            *,
            users (first_name, last_name)
          )
        ),
        student_plans (
          *,
          plans (*)
        )
      `)
      .eq('student_id', this.student.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }

    return data || [];
  }

  // Check if user can book a session
  async canBookSession(sessionId, studentPlanId) {
    if (!this.student) throw new Error('Student not initialized');

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw new Error('Session not found');

    // Get student plan details
    const { data: studentPlan, error: planError } = await supabase
      .from('student_plans')
      .select('*')
      .eq('id', studentPlanId)
      .single();

    if (planError) throw new Error('Student plan not found');

    // Check if plan is active and not expired
    const today = new Date().toISOString().split('T')[0];
    if (studentPlan.status !== 'active' || studentPlan.end_date < today) {
      throw new Error('Plan is not active or has expired');
    }

    // Check if student has enough credits
    if (!studentPlan.is_unlimited && studentPlan.remaining_credits < 1) {
      throw new Error('Insufficient credits');
    }

    // Check if session has available spots
    if (session.spots_left <= 0) {
      throw new Error('Session is full');
    }

    // Check booking cutoff (5 minutes before session)
    const sessionDateTime = new Date(`${session.session_date}T${session.session_time}`);
    const cutoffTime = new Date(sessionDateTime.getTime() - (session.booking_cutoff_minutes * 60 * 1000));
    const now = new Date();

    if (now >= cutoffTime) {
      throw new Error('Booking cutoff time has passed');
    }

    // Check if already booked
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('*')
      .eq('student_id', this.student.id)
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .single();

    if (existingBooking) {
      throw new Error('Already booked for this session');
    }

    return true;
  }

  // Book a session
  async bookSession(sessionId, studentPlanId) {
    if (!this.student) throw new Error('Student not initialized');

    // Verify booking is allowed
    await this.canBookSession(sessionId, studentPlanId);

    // Get session and student plan details
    const [sessionResponse, studentPlanResponse] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('student_plans').select('*').eq('id', studentPlanId).single()
    ]);

    if (sessionResponse.error) throw new Error('Session not found');
    if (studentPlanResponse.error) throw new Error('Student plan not found');

    const session = sessionResponse.data;
    const studentPlan = studentPlanResponse.data;

    // Create the booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        student_id: this.student.id,
        session_id: sessionId,
        student_plan_id: studentPlanId,
        status: 'active',
        booking_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      throw error;
    }

    // Deduct credit if not unlimited
    if (!studentPlan.is_unlimited) {
      await supabase.rpc('create_credit_transaction', {
        p_student_plan_id: studentPlanId,
        p_transaction_type: 'debit',
        p_amount: 1,
        p_reference_id: booking.id,
        p_reference_type: 'booking',
        p_description: `Booked session: ${session.session_date} at ${session.session_time}`
      });
    }

    return booking;
  }

  // Check if user can cancel a booking
  async canCancelBooking(bookingId) {
    if (!this.student) throw new Error('Student not initialized');

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        sessions (*)
      `)
      .eq('id', bookingId)
      .eq('student_id', this.student.id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    if (booking.status !== 'active') {
      throw new Error('Booking is not active');
    }

    // Check cancellation cutoff (2 hours before session)
    const sessionDateTime = new Date(`${booking.sessions.session_date}T${booking.sessions.session_time}`);
    const cutoffTime = new Date(sessionDateTime.getTime() - (booking.sessions.cancellation_cutoff_hours * 60 * 60 * 1000));
    const now = new Date();

    if (now >= cutoffTime) {
      throw new Error('Cancellation cutoff time has passed');
    }

    return true;
  }

  // Cancel a booking
  async cancelBooking(bookingId) {
    if (!this.student) throw new Error('Student not initialized');

    // Verify cancellation is allowed
    await this.canCancelBooking(bookingId);

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        sessions (*),
        student_plans (*)
      `)
      .eq('id', bookingId)
      .eq('student_id', this.student.id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelled by user'
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      throw error;
    }

    // Refund credit if not unlimited
    if (!booking.student_plans.is_unlimited) {
      await supabase.rpc('create_credit_transaction', {
        p_student_plan_id: booking.student_plan_id,
        p_transaction_type: 'credit',
        p_amount: 1,
        p_reference_id: booking.id,
        p_reference_type: 'cancellation',
        p_description: `Cancelled session: ${booking.sessions.session_date} at ${booking.sessions.session_time}`
      });
    }

    return { success: true };
  }

  // Get credit transactions for audit trail
  async getCreditTransactions() {
    if (!this.student) throw new Error('Student not initialized');

    const { data, error } = await supabase
      .from('credit_transactions')
      .select(`
        *,
        student_plans (
          *,
          plans (*)
        )
      `)
      .in('student_plan_id', 
        supabase
          .from('student_plans')
          .select('id')
          .eq('student_id', this.student.id)
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching credit transactions:', error);
      throw error;
    }

    return data || [];
  }

  // Update student profile
  async updateStudentProfile(profileData) {
    if (!this.student) throw new Error('Student not initialized');

    const { data, error } = await supabase
      .from('students')
      .update({
        full_name: profileData.full_name,
        birthdate: profileData.birthdate,
        phone_number: profileData.phone_number,
        allergies: profileData.allergies,
        afflictions: profileData.afflictions,
        emergency_contact_name: profileData.emergency_contact_name,
        emergency_contact_phone: profileData.emergency_contact_phone,
        fitness_level: profileData.fitness_level,
        fitness_goals: profileData.fitness_goals,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.student.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating student profile:', error);
      throw error;
    }

    this.student = data;
    return data;
  }

  // Get student profile
  async getStudentProfile() {
    if (!this.student) throw new Error('Student not initialized');

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', this.student.id)
      .single();

    if (error) {
      console.error('Error fetching student profile:', error);
      throw error;
    }

    this.student = data;
    return data;
  }

  // Get class types for filtering
  async getClassTypes() {
    const { data, error } = await supabase
      .from('class_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching class types:', error);
      throw error;
    }

    return data || [];
  }

  // Get rooms for filtering
  async getRooms() {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }

    return data || [];
  }
}

export default ApiService; 