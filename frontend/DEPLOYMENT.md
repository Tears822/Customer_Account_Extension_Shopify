# Deployment Guide - Shopify Customer Account Extension

This guide will walk you through deploying your fitness booking Customer Account Extension to Shopify.

## Prerequisites

1. **Shopify Partner Account** - You need a Shopify Partner account
2. **Shopify CLI** - Install the latest Shopify CLI
3. **Supabase Project** - Set up and configured
4. **Domain/URL** - For your app (can use ngrok for development)

## Step 1: Setup Shopify Partner Account

1. Go to [Shopify Partners](https://partners.shopify.com)
2. Create a new app in your partner account
3. Note down your **Client ID** and **Client Secret**

## Step 2: Configure App Settings

### Update shopify.app.toml

Edit the `shopify.app.toml` file in the root directory:

```toml
name = "fitness-booking-app"
client_id = "your_actual_client_id_from_partner_account"
application_url = "https://your-app-domain.com"
embedded = true

[access_scopes]
scopes = "read_customers,write_customers,read_orders,write_orders,read_products,write_products"

[auth]
redirect_urls = [
  "https://your-app-domain.com/auth/callback",
  "https://your-app-domain.com/auth/shopify/callback",
  "https://your-app-domain.com/api/auth/callback"
]

[webhooks]
api_version = "2023-10"

[pos]
embedded = false

[build]
automatically_update_urls_on_dev = true
dev_store_url = "your-dev-store.myshopify.com"
include_config_on_deploy = true
```

### Update Environment Variables

1. Copy `env.example` to `.env` in the frontend directory
2. Add your Supabase credentials:

```bash
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
```

## Step 3: Setup Development Environment

### Install Dependencies

```bash
cd frontend
npm install
```

### Link App Configuration

```bash
# From the root directory (where shopify.app.toml is located)
shopify app config link
```

### Start Development Server

```bash
cd frontend
npm run dev
```

This will:
- Start the development server
- Open your app in the browser
- Allow you to install the app on your development store

## Step 4: Install on Development Store

1. Run `npm run dev` in the frontend directory
2. Follow the prompts to install the app on your development store
3. The extension will be automatically deployed to your development store

## Step 5: Test the Extension

1. Go to your development store
2. Navigate to a customer account
3. You should see the "Book Classes" button in the menu
4. Click it to access the booking interface

## Step 6: Deploy to Production

### Build the Extension

```bash
cd frontend
npm run build
```

### Deploy to Production Store

```bash
npm run deploy
```

## Step 7: Configure Production Settings

### In Shopify Partner Dashboard

1. Go to your app in the Partner Dashboard
2. Update the **App URL** to your production domain
3. Add your production domain to **Allowed redirection URLs**
4. Update webhook endpoints if using the webhook server

### Environment Variables for Production

Make sure your production environment has the correct Supabase credentials:

```bash
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_supabase_anon_key
SHOPIFY_SHOP_DOMAIN=your-production-store.myshopify.com
```

## Step 8: Install on Production Store

1. Go to your production Shopify store admin
2. Navigate to Apps > App and sales channel settings
3. Click "Develop apps"
4. Install your app
5. The Customer Account Extension will be automatically available

## Troubleshooting

### Common Issues

1. **Extension not showing up**
   - Check that the app is installed on the store
   - Verify the extension is enabled in the app settings
   - Check browser console for errors

2. **Supabase connection errors**
   - Verify environment variables are set correctly
   - Check Supabase RLS policies
   - Ensure the anon key has proper permissions

3. **Build errors**
   - Make sure all dependencies are installed
   - Check for syntax errors in React components
   - Verify Shopify CLI is up to date

4. **Deployment errors**
   - Check that your app is properly configured in Partner Dashboard
   - Verify client ID and secret are correct
   - Ensure your domain is properly configured

### Development Tips

- Use `shopify app dev` for local development
- Check the Shopify CLI output for detailed error messages
- Use browser developer tools to debug the extension
- Test with different customer accounts

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **Supabase Keys**: Use the anon key for frontend, service role key only for backend
3. **RLS Policies**: Ensure proper Row Level Security is configured in Supabase
4. **CORS**: Configure Supabase to allow your Shopify domain

## Monitoring

After deployment, monitor:

1. **Extension performance** in Shopify admin
2. **Supabase logs** for database operations
3. **Customer feedback** and usage patterns
4. **Error rates** and debugging information

## Support

If you encounter issues:

1. Check the Shopify CLI documentation
2. Review Supabase logs and documentation
3. Test in development store first
4. Check browser console for JavaScript errors 