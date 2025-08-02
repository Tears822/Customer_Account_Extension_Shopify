import React from 'react';
import { extend, render } from '@shopify/ui-extensions-react/customer-account';
import ClassBookingExtension from './components/ClassBookingExtension';

// Extend the customer account UI
extend('CustomerAccount::FullPage::RenderWithin', (root, { customer, i18n }) => {
  // Render the booking extension
  render(root, <ClassBookingExtension customer={customer} i18n={i18n} />);
}); 