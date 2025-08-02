import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Text, 
  BlockStack, 
  InlineStack, 
  Badge, 
  Modal,
  Divider,
  Icon
} from '@shopify/ui-extensions-react/customer-account';
import { 
  Calendar, 
  Clock, 
  Users, 
  CreditCard, 
  AlertCircle, 
  CheckCircle 
} from 'lucide-react';

// API configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

const ClassBookingExtension = ({ customer, i18n }) => {
  const [activeTab, setActiveTab] = useState('sessions');
  const [userPlans, setUserPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [notification, setNotification] = useState(null);
  const [filterType, setFilterType] = useState('all');

  // Use actual Shopify customer data
  const currentUser = {
    id: customer.id,
    email: customer.email,
    first_name: customer.firstName,
    last_name: customer.lastName
  };

  // API helper function
  const apiCall = async (endpoint, options = {}) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'x-shopify-customer-id': customer.id
    };

    const config = {
      headers: { ...defaultHeaders, ...options.headers },
      ...options
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load user plans, sessions, and bookings in parallel
      const [plansResponse, sessionsResponse, bookingsResponse] = await Promise.all([
        apiCall('/plans/user-plans'),
        apiCall('/sessions/'),
        apiCall('/bookings/')
      ]);

      setUserPlans(plansResponse.data || []);
      setSessions(sessionsResponse.data || []);
      setBookings(bookingsResponse.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showNotification('Error loading data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const bookSession = async (sessionId) => {
    try {
      const response = await apiCall('/bookings/', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      });

      showNotification('🎉 Session booked successfully! See you in class!');
      setSelectedSession(null);
      loadData(); // Refresh data to show updated credits and bookings
    } catch (error) {
      console.error('Error booking session:', error);
      showNotification(error.message || 'Unable to book session. Please try again.', 'error');
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      await apiCall(`/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Cancelled by user' })
      });

      showNotification('Booking cancelled successfully. Credit refunded to your account.');
      loadData(); // Refresh data to show updated credits and bookings
    } catch (error) {
      console.error('Error cancelling booking:', error);
      showNotification(error.message || 'Unable to cancel booking. Please contact support.', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getIntensityBadge = (level) => {
    const intensityColors = {
      1: 'success',
      2: 'warning',
      3: 'attention',
      4: 'critical',
      5: 'info'
    };
    
    return (
      <Badge tone={intensityColors[level] || 'subdued'}>
        {'🔥'.repeat(level)} Level {level}
      </Badge>
    );
  };

  const canBookSession = (sessionDate, sessionTime, bookingCutoffMinutes = 5) => {
    const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);
    const now = new Date();
    const cutoffTime = new Date(sessionDateTime.getTime() - (bookingCutoffMinutes * 60 * 1000));
    return now < cutoffTime;
  };

  const canCancelBooking = (sessionDate, sessionTime, cancellationCutoffHours = 2) => {
    const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);
    const cancellationDeadline = new Date(sessionDateTime.getTime() - (cancellationCutoffHours * 60 * 60 * 1000));
    return new Date() < cancellationDeadline;
  };

  const filteredSessions = sessions.filter(session => {
    if (filterType === 'all') return true;
    return session.class?.class_type?.category === filterType;
  });

  const totalCredits = userPlans.reduce((sum, plan) => 
    plan.is_unlimited ? 999 : sum + plan.remaining_credits, 0);

  if (loading) {
    return (
      <BlockStack gap="loose" alignment="center">
        <Text>Loading your fitness journey...</Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="loose">
      {/* Header */}
      <Card>
        <BlockStack gap="tight">
          <Text variant="headingLg" as="h1">
            Welcome Back, {currentUser.first_name}
          </Text>
          <Text tone="subdued">Ready to crush your fitness goals?</Text>
          <InlineStack gap="loose">
            <BlockStack gap="tight">
              <Text variant="headingMd">{totalCredits === 999 ? '∞' : totalCredits}</Text>
              <Text tone="subdued">Credits Available</Text>
            </BlockStack>
            <BlockStack gap="tight">
              <Text variant="headingMd" tone="success">{bookings.length}</Text>
              <Text tone="subdued">Active Bookings</Text>
            </BlockStack>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Credits Summary */}
      <Card>
        <BlockStack gap="loose">
          <InlineStack gap="tight" alignment="center">
            <Icon source={CreditCard} />
            <Text variant="headingMd">Your Memberships</Text>
          </InlineStack>
          
          {userPlans.length === 0 ? (
            <Card tone="subdued">
              <Text>No active memberships. Purchase a class pack to start booking!</Text>
            </Card>
          ) : (
            userPlans.map((plan) => (
              <Card key={plan.id} tone="subdued">
                <BlockStack gap="tight">
                  <Text variant="headingSm">{plan.plan.name}</Text>
                  <Text tone="subdued">{plan.plan.description}</Text>
                  <InlineStack gap="loose" alignment="space-between">
                    <BlockStack gap="tight">
                      <InlineStack gap="tight" alignment="baseline">
                        <Text variant="headingLg">
                          {plan.is_unlimited ? '∞' : plan.remaining_credits}
                        </Text>
                        {!plan.is_unlimited && (
                          <Text tone="subdued">/ {plan.plan.credits}</Text>
                        )}
                      </InlineStack>
                      <Text tone="subdued">
                        {plan.is_unlimited ? 'Unlimited' : 'Credits remaining'}
                      </Text>
                    </BlockStack>
                    <Text tone="subdued">
                      Expires {new Date(plan.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>
            ))
          )}
        </BlockStack>
      </Card>

      {/* Navigation Tabs */}
      <InlineStack gap="tight">
        <Button
          pressed={activeTab === 'sessions'}
          onPress={() => setActiveTab('sessions')}
        >
          Available Classes
        </Button>
        <Button
          pressed={activeTab === 'bookings'}
          onPress={() => setActiveTab('bookings')}
        >
          My Bookings
        </Button>
      </InlineStack>

      {/* Available Sessions Tab */}
      {activeTab === 'sessions' && (
        <BlockStack gap="loose">
          {/* Filters */}
          <InlineStack gap="tight">
            {['all', 'yoga', 'cardio', 'strength', 'pilates', 'hiit'].map((type) => (
              <Button
                key={type}
                pressed={filterType === type}
                onPress={() => setFilterType(type)}
              >
                {type === 'all' ? 'All Classes' : type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </InlineStack>

          {/* Sessions Grid */}
          <BlockStack gap="loose">
            {filteredSessions.length === 0 ? (
              <Card>
                <Text>No sessions available for the selected filters.</Text>
              </Card>
            ) : (
              filteredSessions.map((session) => {
                const canBook = canBookSession(session.session_date, session.session_time, session.booking_cutoff_minutes);
                
                return (
                  <Card key={session.id}>
                    <BlockStack gap="loose">
                      <InlineStack gap="loose" alignment="space-between">
                        <BlockStack gap="tight">
                          <Text variant="headingMd">{session.class.name}</Text>
                          <Text tone="subdued">{session.class.description}</Text>
                        </BlockStack>
                        {session.class.class_type && getIntensityBadge(session.class.class_type.intensity_level)}
                      </InlineStack>
                      
                      <BlockStack gap="tight">
                        <InlineStack gap="loose" alignment="space-between">
                          <InlineStack gap="tight" alignment="center">
                            <Icon source={Calendar} />
                            <Text>{formatDate(session.session_date)}</Text>
                          </InlineStack>
                          <InlineStack gap="tight" alignment="center">
                            <Icon source={Clock} />
                            <Text>{formatTime(session.session_time)} ({session.duration_minutes}min)</Text>
                          </InlineStack>
                        </InlineStack>
                        
                        <InlineStack gap="loose" alignment="space-between">
                          <InlineStack gap="tight" alignment="center">
                            <Icon source={MapPin} />
                            <Text>{session.class.room?.name || 'TBD'}</Text>
                          </InlineStack>
                          <InlineStack gap="tight" alignment="center">
                            <Icon source={Users} />
                            <Text>{session.spots_left} spots left</Text>
                          </InlineStack>
                        </InlineStack>
                      </BlockStack>

                      <Divider />

                      <InlineStack gap="loose" alignment="space-between">
                        <Text>
                          {session.instructor?.user?.first_name} {session.instructor?.user?.last_name}
                        </Text>
                        
                        {session.spots_left === 0 ? (
                          <Button disabled>Class Full</Button>
                        ) : !canBook ? (
                          <Button disabled>Booking Closed</Button>
                        ) : (
                          <Button
                            onPress={() => setSelectedSession(session)}
                          >
                            Book Class
                          </Button>
                        )}
                      </InlineStack>
                    </BlockStack>
                  </Card>
                );
              })
            )}
          </BlockStack>
        </BlockStack>
      )}

      {/* My Bookings Tab */}
      {activeTab === 'bookings' && (
        <BlockStack gap="loose">
          {bookings.length === 0 ? (
            <Card>
              <Text>No active bookings. Book your first class to get started!</Text>
            </Card>
          ) : (
            bookings.map((booking) => {
              const canCancel = canCancelBooking(
                booking.session.session_date, 
                booking.session.session_time, 
                booking.session.cancellation_cutoff_hours
              );
              
              return (
                <Card key={booking.id}>
                  <BlockStack gap="loose">
                    <Text variant="headingMd">{booking.session.class.name}</Text>
                    
                    <BlockStack gap="tight">
                      <InlineStack gap="loose" alignment="space-between">
                        <InlineStack gap="tight" alignment="center">
                          <Icon source={Calendar} />
                          <Text>{formatDate(booking.session.session_date)}</Text>
                        </InlineStack>
                        <InlineStack gap="tight" alignment="center">
                          <Icon source={Clock} />
                          <Text>{formatTime(booking.session.session_time)} ({booking.session.duration_minutes}min)</Text>
                        </InlineStack>
                      </InlineStack>
                      
                      <InlineStack gap="loose" alignment="space-between">
                        <InlineStack gap="tight" alignment="center">
                          <Icon source={MapPin} />
                          <Text>{booking.session.class.room?.name || 'TBD'}</Text>
                        </InlineStack>
                        <InlineStack gap="tight" alignment="center">
                          <Text>
                            {booking.session.instructor?.user?.first_name} {booking.session.instructor?.user?.last_name}
                          </Text>
                        </InlineStack>
                      </InlineStack>
                    </BlockStack>

                    <InlineStack gap="loose" alignment="space-between">
                      <Badge tone={booking.status === 'active' ? 'success' : 'subdued'}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Badge>
                      
                      {booking.status === 'active' && (
                        canCancel ? (
                          <Button
                            tone="critical"
                            onPress={() => cancelBooking(booking.id)}
                          >
                            Cancel
                          </Button>
                        ) : (
                          <Button disabled>Cannot Cancel</Button>
                        )
                      )}
                    </InlineStack>
                  </BlockStack>
                </Card>
              );
            })
          )}
        </BlockStack>
      )}

      {/* Booking Confirmation Modal */}
      {selectedSession && (
        <Modal
          open={true}
          onClose={() => setSelectedSession(null)}
          title="Confirm Booking"
        >
          <BlockStack gap="loose">
            <Text variant="headingMd">{selectedSession.class.name}</Text>
            <Text tone="subdued">{selectedSession.class.description}</Text>
            
            <BlockStack gap="tight">
              <InlineStack gap="loose" alignment="space-between">
                <Text>Date</Text>
                <Text>{formatDate(selectedSession.session_date)}</Text>
              </InlineStack>
              <InlineStack gap="loose" alignment="space-between">
                <Text>Time</Text>
                <Text>{formatTime(selectedSession.session_time)} ({selectedSession.duration_minutes}min)</Text>
              </InlineStack>
              <InlineStack gap="loose" alignment="space-between">
                <Text>Available Spots</Text>
                <Text>{selectedSession.spots_left} remaining</Text>
              </InlineStack>
              <InlineStack gap="loose" alignment="space-between">
                <Text>Cost</Text>
                <Text>1 Credit</Text>
              </InlineStack>
            </BlockStack>

            <InlineStack gap="loose">
              <Button
                onPress={() => setSelectedSession(null)}
              >
                Cancel
              </Button>
              <Button
                primary
                onPress={() => bookSession(selectedSession.id)}
              >
                Confirm Booking
              </Button>
            </InlineStack>
          </BlockStack>
        </Modal>
      )}

      {/* Notification */}
      {notification && (
        <Card tone={notification.type === 'error' ? 'critical' : 'success'}>
          <InlineStack gap="tight" alignment="center">
            <Icon source={notification.type === 'error' ? AlertCircle : CheckCircle} />
            <Text>{notification.message}</Text>
          </InlineStack>
        </Card>
      )}
    </BlockStack>
  );
};

export default ClassBookingExtension; 