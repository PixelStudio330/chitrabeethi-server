const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Central Conversion Factor matching your Stripe engine configuration
const BDT_TO_USD_RATE = 127.3314;

// @desc     Create Stripe Checkout Session for Artwork Purchase
// @route    POST /api/payments/create-artwork-checkout
exports.createArtworkCheckout = async (req, res) => {
  try {
    const { artworkId, userId } = req.body;

    // 1. Find artwork and buyer
    const artwork = await Artwork.findById(artworkId);
    const user = await User.findById(userId);

    if (!artwork) return res.status(404).json({ message: "Artwork not found" });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (artwork.status === 'sold') return res.status(400).json({ message: "This masterpiece is already sold out" });

    // 2. Assignment Check: Verify Subscription Limits
    const purchaseCount = await Transaction.countDocuments({ buyerId: userId, type: 'purchase' });
    
    if (user.subscriptionTier === 'free' && purchaseCount >= 3) {
      return res.status(403).json({ message: "Free Tier limit reached (Max 3). Please upgrade to Pro or Premium!" });
    }
    if (user.subscriptionTier === 'pro' && purchaseCount >= 9) {
      return res.status(403).json({ message: "Pro Tier limit reached (Max 9). Please upgrade to Premium!" });
    }

    // 3. Dynamic BDT to USD conversion calculation for Stripe Engine Processing
    // Artwork price in database (BDT) -> Converted to USD Cents
    const priceInUsdCents = Math.round((artwork.price / BDT_TO_USD_RATE) * 100);

    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/user?session_id={CHECKOUT_SESSION_ID}&artworkId=${artworkId}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/artworks/${artworkId}`,
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd', // Global currency setting to bypass region account limits
            product_data: {
              name: artwork.name,
              description: artwork.description || "Original Artwork",
              images: artwork.img ? [artwork.img] : [],
            },
            unit_amount: priceInUsdCents, 
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'purchase',
        artworkId: artworkId,
        userId: userId,
        originalBdtPrice: artwork.price.toString() // Store real BDT value as metadata string
      }
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ message: "Stripe integration failure", error: error.message });
  }
};

// @desc     Confirm and Save Transaction via Frontend Dashboard Callback
// @route    POST /api/payments/verify-payment
exports.verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const existingTx = await Transaction.findOne({ transactionId: sessionId });
    if (existingTx) {
      return res.status(200).json({ message: "Already verified", transaction: existingTx });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const { type, artworkId, userId, originalBdtPrice } = session.metadata;
      
      // Fallback calculation back up logic if original BDT field gets skipped
      const finalBdtAmount = originalBdtPrice ? Number(originalBdtPrice) : Math.round((session.amount_total / 100) * BDT_TO_USD_RATE);

      const transaction = new Transaction({
        transactionId: session.id,
        type: type,
        buyerId: userId,
        artworkId: type === 'purchase' ? artworkId : undefined,
        subscriptionTier: type === 'subscription' ? session.metadata.subscriptionTier : undefined,
        amount: finalBdtAmount, // Restored completely to BDT 
        buyerEmail: session.customer_details.email,
        status: 'successful'
      });
      await transaction.save();

      if (type === 'purchase') {
        await Artwork.findByIdAndUpdate(artworkId, { status: 'sold' });
      }

      console.log(`\n=== 📬 SIMULATED EMAIL SYSTEM ===\nTo: ${session.customer_details.email}\nSubject: ArtHub Order Confirmed!\nMessage: Thank you for your payment of ৳${finalBdtAmount}. Your collection vault has been updated safely.\n=================================\n`);

      return res.status(201).json({ message: "Payment verified and saved", transaction });
    }

    res.status(400).json({ message: "Payment was not completed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Verification system error", error: error.message });
  }
};

// @desc     Autonomous Server-to-Server Direct Webhook handler
// @route    POST /api/payments/webhook
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`❌ Webhook security validation failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful execution completion directly from Stripe events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { type, artworkId, userId, originalBdtPrice } = session.metadata;

    console.log(`🔔 Webhook received successfully! Processing transaction: ${session.id}`);

    try {
      // 1. Deduce the absolute BDT price from metadata safely
      const finalBdtAmount = originalBdtPrice ? Number(originalBdtPrice) : Math.round((session.amount_total / 100) * BDT_TO_USD_RATE);

      // 2. Prevent entry collisions/duplicate transaction logs
      const cleanSessionId = session.id;
      const duplicateCheck = await Transaction.findOne({ transactionId: cleanSessionId });
      
      if (!duplicateCheck) {
      // 3. Commit Transaction to MongoDB
const transaction = new Transaction({
  transactionId: cleanSessionId,
  type: type,
  buyerId: userId,
  artworkId: type === 'purchase' ? artworkId : undefined,
  subscriptionTier: type === 'subscription' ? session.metadata.subscriptionTier : undefined,
  amount: finalBdtAmount, // Saved clearly in native BDT (৳)
  buyerEmail: session.customer_details?.email,
  status: 'successful'
  // 💡 Removed manual createdAt line to let Mongoose timestamps engine do the work perfectly!
});
await transaction.save();

        // 4. Transform asset pool status configuration parameters
        if (type === 'purchase') {
          await Artwork.findByIdAndUpdate(artworkId, { status: 'sold' });
        }

        // 5. Fire Simulated Email confirmation log
        console.log(`\n=== 📬 SIMULATED EMAIL SYSTEM (WEBHOOK) ===\nTo: ${session.customer_details?.email}\nSubject: Chitrabeethi Vault Secured!\nMessage: Processing complete! Your payment of ৳${finalBdtAmount} has cleared. Transaction record synced for accounting management.\n============================================\n`);
      }
    } catch (dbErr) {
      console.error('❌ Error handling webhook data writing sequence to MongoDB:', dbErr);
      return res.status(500).send('Database storage fault');
    }
  }

  res.status(200).json({ received: true });
};