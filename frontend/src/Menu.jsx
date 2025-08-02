import React from 'react';
import { extend, render, Button } from '@shopify/ui-extensions-react/customer-account';

// Extend the customer account menu
extend('CustomerAccount::Menu::RenderAfter', (root, { customer, i18n }) => {
  // Add a booking menu item
  render(
    root,
    <Button
      onPress={() => {
        // Navigate to the booking page
        window.location.href = '/account#/booking';
      }}
    >
      Book Classes
    </Button>
  );
}); 