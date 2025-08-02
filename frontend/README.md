# Shopify Customer Account Booking Extension

A fitness class booking extension for Shopify customer accounts that allows customers to view their class credits and book sessions.

## Features

- 🏋️‍♀️ **View Class Credits** - Display purchased class packs and remaining credits
- 📅 **Book Sessions** - Browse and book available fitness classes
- 📋 **Manage Bookings** - View and cancel existing bookings
- 💳 **Credit Tracking** - Real-time credit balance and expiration tracking
- 🔒 **Secure** - Integrated with Shopify's customer authentication

## Quick Start

### 1. Install Dependencies

```bash
cd extensions/customer-account-booking
npm install
```

### 2. Development

```bash
npm run dev
```

### 3. Deploy

```bash
npm run deploy
```

## Extension Structure

```
extensions/customer-account-booking/
├── shopify.extension.toml    # Extension configuration
├── package.json              # Dependencies and scripts
├── src/
│   ├── index.jsx             # Main extension entry point
│   ├── Menu.jsx              # Menu extension point
│   └── components/
│       └── ClassBookingExtension.jsx  # Main booking component
└── README.md
```

## Extension Points

### Full Page Extension
- **Target**: `CustomerAccount::FullPage::RenderWithin`
- **Purpose**: Renders the main booking interface in the customer account

### Menu Extension
- **Target**: `CustomerAccount::Menu::RenderAfter`
- **Purpose**: Adds a "Book Classes" button to the customer account menu

## Configuration

### Environment Variables
The extension will need access to:
- Supabase URL and API keys
- Shopify webhook endpoints
- Class session data

### Shopify App Setup
1. Create a Shopify app in your partner account
2. Add the Customer Account UI Extension
3. Configure the extension points
4. Deploy to your development store

## Integration with Webhook Handler

This extension works with the webhook handler in the `Webhook_Handler/` directory to:
- Sync customer data from Shopify orders
- Track class credit usage
- Manage booking availability

## Development

### Local Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Shopify
npm run deploy
```

### Testing
- Test in Shopify development store
- Verify customer account integration
- Check booking functionality

## Deployment

### To Development Store
```bash
shopify app deploy
```

### To Production Store
```bash
shopify app deploy --store=your-store.myshopify.com
```

## Support

For issues or questions:
1. Check Shopify extension documentation
2. Verify extension configuration
3. Test in development store first
4. Review extension logs

## License

MIT License - see LICENSE file for details 