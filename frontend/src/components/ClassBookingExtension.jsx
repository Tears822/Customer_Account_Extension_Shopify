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
  Icon,
  Select
} from '@shopify/ui-extensions-react/customer-account';
import { 
  Calendar, 
  Clock, 
  Users, 
  CreditCard, 
  AlertCircle, 
  CheckCircle,
  MapPin,
  User,
  Zap
} from 'lucide-react';
import ApiService from '../services/api';

const ClassBookingExtension = ({ customer, i18n }) => {
  const [activeTab, setActiveTab] = useState('sessions');
  const [userPlans, setUserPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [classTypes, setClassTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [notification, setNotification] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [selectedClassType, setSelectedClassType] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [apiService] = useState(new ApiService());

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    setLoading(true);
    try {
      // Initialize user and student data
      await apiService.initialize(customer);
      
      // Load all data in parallel
      const [plans, sessionsData, bookingsData, transactionsData, typesData, roomsData] = await Promise.all([
        apiService.getUserPlans(),
        apiService.getSessions(),
        apiService.getBookings(),
        apiService.getCreditTransactions(),
        apiService.getClassTypes(),
        apiService.getRooms()
      ]);

      setUserPlans(plans);
      setSessions(sessionsData);
      setBookings(bookingsData);
      setCreditTransactions(transactionsData);
      setClassTypes(typesData);
      setRooms(roomsData);
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

  const bookSession = async (sessionId, studentPlanId) => {
    try {
      await apiService.bookSession(sessionId, studentPlanId);
      showNotification('Session booked successfully!');
      
      // Refresh data
      const [plans, bookings, transactions] = await Promise.all([
        apiService.getUserPlans(),
        apiService.getBookings(),
        apiService.getCreditTransactions()
      ]);
      setUserPlans(plans);
      setBookings(bookings);
      setCreditTransactions(transactions);
      setSelectedSession(null);
    } catch (error) {
      console.error('Error booking session:', error);
      showNotification(error.message || 'Error booking session', 'error');
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      await apiService.cancelBooking(bookingId);
      showNotification('Booking cancelled successfully! Credit refunded.');
      
      // Refresh data
      const [plans, bookings, transactions] = await Promise.all([
        apiService.getUserPlans(),
        apiService.getBookings(),
        apiService.getCreditTransactions()
      ]);
      setUserPlans(plans);
      setBookings(bookings);
      setCreditTransactions(transactions);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      showNotification(error.message || 'Error cancelling booking', 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getIntensityBadge = (level) => {
    const colors = {
      1: 'success',
      2: 'success',
      3: 'warning',
      4: 'critical',
      5: 'critical'
    };
    return <Badge tone={colors[level] || 'info'}>Level {level}</Badge>;
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'success',
      cancelled: 'subdued',
      completed: 'info',
      no_show: 'critical'
    };
    return <Badge tone={colors[status] || 'subdued'}>{status}</Badge>;
  };

  const getFilteredSessions = () => {
    let filtered = sessions;

    // Filter by date
    if (filterType !== 'all') {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      
      filtered = filtered.filter(session => {
        const sessionDate = session.session_date;
        const sessionTime = session.session_time;
        const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);
        
        switch (filterType) {
          case 'today':
            return sessionDate === today;
          case 'upcoming':
            return sessionDateTime > now;
          case 'past':
            return sessionDateTime < now;
          default:
            return true;
        }
      });
    }

    // Filter by class type
    if (selectedClassType !== 'all') {
      filtered = filtered.filter(session => 
        session.classes.class_types.id === selectedClassType
      );
    }

    // Filter by room
    if (selectedRoom !== 'all') {
      filtered = filtered.filter(session => 
        session.classes.rooms?.id === selectedRoom
      );
    }

    return filtered;
  };

  const getFilteredBookings = () => {
    if (filterType === 'all') return bookings;
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    return bookings.filter(booking => {
      const sessionDate = booking.sessions.session_date;
      const sessionTime = booking.sessions.session_time;
      const sessionDateTime = new Date(`${sessionDate}T${sessionTime}`);
      
      switch (filterType) {
        case 'today':
          return sessionDate === today;
        case 'upcoming':
          return sessionDateTime > now;
        case 'past':
          return sessionDateTime < now;
        default:
          return true;
      }
    });
  };

  const renderSessionsTab = () => {
    const filteredSessions = getFilteredSessions();
    
    if (loading) {
      return (
        <BlockStack gap="loose">
          <Text>Loading sessions...</Text>
        </BlockStack>
      );
    }

    if (filteredSessions.length === 0) {
      return (
        <BlockStack gap="loose">
          <Text>No sessions available for the selected filters.</Text>
        </BlockStack>
      );
    }

    return (
      <BlockStack gap="loose">
        {filteredSessions.map(session => (
          <Card key={session.id}>
            <BlockStack gap="tight">
              <InlineStack align="space-between">
                <Text variant="headingMd">{session.classes.name}</Text>
                {getIntensityBadge(session.classes.class_types.intensity_level)}
              </InlineStack>
              
              <Text tone="subdued">{session.classes.description}</Text>
              
              <InlineStack gap="tight">
                <Icon source={Calendar} />
                <Text>{formatDate(session.session_date)}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={Clock} />
                <Text>{formatTime(session.session_time)} - {formatTime(new Date(`2000-01-01T${session.session_time}`).getTime() + session.duration_minutes * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={User} />
                <Text>{session.instructors.users.first_name} {session.instructors.users.last_name}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={MapPin} />
                <Text>{session.classes.rooms?.name || 'TBD'}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={Users} />
                <Text>{session.spots_left} spots left</Text>
              </InlineStack>
              
              {userPlans.length > 0 && session.spots_left > 0 && (
                <Button
                  onPress={() => setSelectedSession(session)}
                  variant="primary"
                >
                  Book Session
                </Button>
              )}
              
              {session.spots_left === 0 && (
                <Text tone="subdued">Session is full</Text>
              )}
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    );
  };

  const renderBookingsTab = () => {
    const filteredBookings = getFilteredBookings();
    
    if (loading) {
      return (
        <BlockStack gap="loose">
          <Text>Loading bookings...</Text>
        </BlockStack>
      );
    }

    if (filteredBookings.length === 0) {
      return (
        <BlockStack gap="loose">
          <Text>No bookings found.</Text>
        </BlockStack>
      );
    }

    return (
      <BlockStack gap="loose">
        {filteredBookings.map(booking => (
          <Card key={booking.id}>
            <BlockStack gap="tight">
              <InlineStack align="space-between">
                <Text variant="headingMd">{booking.sessions.classes.name}</Text>
                {getStatusBadge(booking.status)}
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={Calendar} />
                <Text>{formatDate(booking.sessions.session_date)}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={Clock} />
                <Text>{formatTime(booking.sessions.session_time)}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={User} />
                <Text>{booking.sessions.instructors.users.first_name} {booking.sessions.instructors.users.last_name}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={MapPin} />
                <Text>{booking.sessions.classes.rooms?.name || 'TBD'}</Text>
              </InlineStack>
              
              <InlineStack gap="tight">
                <Icon source={CreditCard} />
                <Text>Plan: {booking.student_plans.plans.name}</Text>
              </InlineStack>
              
              {booking.status === 'active' && (
                <Button
                  onPress={() => cancelBooking(booking.id)}
                  variant="secondary"
                  tone="critical"
                >
                  Cancel Booking
                </Button>
              )}
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    );
  };

  const renderPlansTab = () => {
    if (loading) {
      return (
        <BlockStack gap="loose">
          <Text>Loading plans...</Text>
        </BlockStack>
      );
    }

    if (userPlans.length === 0) {
      return (
        <BlockStack gap="loose">
          <Text>No active plans found. Purchase a plan from our store to start booking sessions.</Text>
        </BlockStack>
      );
    }

    return (
      <BlockStack gap="loose">
        {userPlans.map(plan => (
          <Card key={plan.id}>
            <BlockStack gap="tight">
              <Text variant="headingMd">{plan.plans.name}</Text>
              <Text>{plan.plans.description}</Text>
              
              <InlineStack gap="tight">
                <Icon source={CreditCard} />
                <Text>
                  {plan.is_unlimited ? 'Unlimited credits' : `${plan.remaining_credits} credits remaining`}
                </Text>
              </InlineStack>
              
              <Text>Valid until: {formatDate(plan.end_date)}</Text>
              
              <Text tone="subdued">Purchased: {formatDate(plan.plan_purchases.purchased_at)}</Text>
              
              <Badge tone={plan.status === 'active' ? 'success' : 'subdued'}>
                {plan.status}
              </Badge>
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    );
  };

  const renderTransactionsTab = () => {
    if (loading) {
      return (
        <BlockStack gap="loose">
          <Text>Loading transactions...</Text>
        </BlockStack>
      );
    }

    if (creditTransactions.length === 0) {
      return (
        <BlockStack gap="loose">
          <Text>No credit transactions found.</Text>
        </BlockStack>
      );
    }

    return (
      <BlockStack gap="loose">
        {creditTransactions.map(transaction => (
          <Card key={transaction.id}>
            <BlockStack gap="tight">
              <InlineStack align="space-between">
                <Text variant="headingMd">{transaction.description}</Text>
                <Badge tone={transaction.transaction_type === 'debit' ? 'critical' : 'success'}>
                  {transaction.transaction_type === 'debit' ? '-' : '+'}{transaction.amount}
                </Badge>
              </InlineStack>
              
              <Text tone="subdued">{transaction.reference_type}</Text>
              
              <Text>Balance: {transaction.balance_after} credits</Text>
              
              <Text tone="subdued">{formatDate(transaction.created_at)}</Text>
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    );
  };

  return (
    <BlockStack gap="loose">
      {/* Notification */}
      {notification && (
        <Card>
          <InlineStack gap="tight" align="center">
            <Icon 
              source={notification.type === 'error' ? AlertCircle : CheckCircle} 
              tone={notification.type === 'error' ? 'critical' : 'success'}
            />
            <Text tone={notification.type === 'error' ? 'critical' : 'success'}>
              {notification.message}
            </Text>
          </InlineStack>
        </Card>
      )}

      {/* Header */}
      <Card>
        <BlockStack gap="tight">
          <Text variant="headingLg">Fitness Class Booking</Text>
          <Text>Welcome back, {customer.firstName}!</Text>
        </BlockStack>
      </Card>

      {/* Filter Tabs */}
      <Card>
        <BlockStack gap="loose">
          <InlineStack gap="tight">
            <Button
              variant={filterType === 'all' ? 'primary' : 'secondary'}
              onPress={() => setFilterType('all')}
            >
              All
            </Button>
            <Button
              variant={filterType === 'today' ? 'primary' : 'secondary'}
              onPress={() => setFilterType('today')}
            >
              Today
            </Button>
            <Button
              variant={filterType === 'upcoming' ? 'primary' : 'secondary'}
              onPress={() => setFilterType('upcoming')}
            >
              Upcoming
            </Button>
            <Button
              variant={filterType === 'past' ? 'primary' : 'secondary'}
              onPress={() => setFilterType('past')}
            >
              Past
            </Button>
          </InlineStack>

          {/* Additional Filters */}
          <InlineStack gap="tight">
            <Select
              label="Class Type"
              value={selectedClassType}
              onValueChange={setSelectedClassType}
              options={[
                { label: 'All Types', value: 'all' },
                ...classTypes.map(type => ({ label: type.name, value: type.id }))
              ]}
            />
            
            <Select
              label="Room"
              value={selectedRoom}
              onValueChange={setSelectedRoom}
              options={[
                { label: 'All Rooms', value: 'all' },
                ...rooms.map(room => ({ label: room.name, value: room.id }))
              ]}
            />
          </InlineStack>
        </BlockStack>
      </Card>

      {/* Main Content Tabs */}
      <Card>
        <BlockStack gap="loose">
          <InlineStack gap="tight">
            <Button
              variant={activeTab === 'sessions' ? 'primary' : 'secondary'}
              onPress={() => setActiveTab('sessions')}
            >
              Available Sessions
            </Button>
            <Button
              variant={activeTab === 'bookings' ? 'primary' : 'secondary'}
              onPress={() => setActiveTab('bookings')}
            >
              My Bookings
            </Button>
            <Button
              variant={activeTab === 'plans' ? 'primary' : 'secondary'}
              onPress={() => setActiveTab('plans')}
            >
              My Plans
            </Button>
            <Button
              variant={activeTab === 'transactions' ? 'primary' : 'secondary'}
              onPress={() => setActiveTab('transactions')}
            >
              Credit History
            </Button>
          </InlineStack>

          <Divider />

          {activeTab === 'sessions' && renderSessionsTab()}
          {activeTab === 'bookings' && renderBookingsTab()}
          {activeTab === 'plans' && renderPlansTab()}
          {activeTab === 'transactions' && renderTransactionsTab()}
        </BlockStack>
      </Card>

      {/* Booking Modal */}
      {selectedSession && (
        <Modal
          open={!!selectedSession}
          onClose={() => setSelectedSession(null)}
          title="Book Session"
        >
          <BlockStack gap="loose">
            <Text variant="headingMd">{selectedSession.classes.name}</Text>
            <Text>{selectedSession.classes.description}</Text>
            
            <InlineStack gap="tight">
              <Icon source={Calendar} />
              <Text>{formatDate(selectedSession.session_date)}</Text>
            </InlineStack>
            
            <InlineStack gap="tight">
              <Icon source={Clock} />
              <Text>{formatTime(selectedSession.session_time)}</Text>
            </InlineStack>

            <InlineStack gap="tight">
              <Icon source={User} />
              <Text>{selectedSession.instructors.users.first_name} {selectedSession.instructors.users.last_name}</Text>
            </InlineStack>

            <InlineStack gap="tight">
              <Icon source={MapPin} />
              <Text>{selectedSession.classes.rooms?.name || 'TBD'}</Text>
            </InlineStack>

            <InlineStack gap="tight">
              <Icon source={Users} />
              <Text>{selectedSession.spots_left} spots available</Text>
            </InlineStack>

            {userPlans.length > 0 ? (
              <BlockStack gap="tight">
                <Text variant="headingSm">Select a plan:</Text>
                {userPlans.map(plan => (
                  <Button
                    key={plan.id}
                    onPress={() => bookSession(selectedSession.id, plan.id)}
                    variant="primary"
                    disabled={!plan.is_unlimited && plan.remaining_credits < 1}
                  >
                    {plan.plans.name} 
                    {!plan.is_unlimited && ` (${plan.remaining_credits} credits)`}
                  </Button>
                ))}
              </BlockStack>
            ) : (
              <Text>No active plans available. Please purchase a plan from our store.</Text>
            )}
          </BlockStack>
        </Modal>
      )}
    </BlockStack>
  );
};

export default ClassBookingExtension; 