const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const BDT_TO_USD_RATE = 127.3314;

exports.createArtworkCheckout = async (req, res) => {
  try {
    const { artworkId, userId } = req.body;

    const artwork = await Artwork.findById(artworkId);
    const user = await User.findById(userId);

    if (!artwork) return res.status(404).json({ message: "Artwork not found" });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (artwork.status === 'sold') return res.status(400).json({ message: "This masterpiece is already sold out" });

    const purchaseCount = await Transaction.countDocuments({ buyerId: userId, type: 'purchase' });
    
    if (user.subscriptionTier === 'free' && purchaseCount >= 3) {
      return res.status(403).json({ message: "Free Tier limit reached (Max 3). Please upgrade to Pro or Premium!" });
    }
    if (user.subscriptionTier === 'pro' && purchaseCount >= 9) {
      return res.status(403).json({ message: "Pro Tier limit reached (Max 9). Please upgrade to Premium!" });
    }

    const priceInUsdCents = Math.round((artwork.price / BDT_TO_USD_RATE) * 100);

    // We change the success URL target redirect line back directly onto your specific detail dynamic path context block!
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/browse/${artworkId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/browse/${artworkId}`,
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
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
        originalBdtPrice: artwork.price.toString()
      }
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ message: "Stripe integration failure", error: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "Session token index target parameter missing." });

    // Check if transaction was already logged previously
    let existingTx = await Transaction.findOne({ transactionId: sessionId });
    if (existingTx) {
      return res.status(200).json({ message: "Already verified", transaction: existingTx });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const { type, artworkId, userId, originalBdtPrice } = session.metadata;
      
      const finalBdtAmount = originalBdtPrice ? Number(originalBdtPrice) : Math.round((session.amount_total / 100) * BDT_TO_USD_RATE);

      existingTx = new Transaction({
        transactionId: session.id,
        type: type,
        buyerId: userId,
        artworkId: type === 'purchase' ? artworkId : undefined,
        amount: finalBdtAmount,
        buyerEmail: session.customer_details.email,
        status: 'successful'
      });
      await existingTx.save();

      // IMPORTANT CRITICAL FIX: Run status sync update directly to ensure local development triggers apply instantly!
      if (type === 'purchase') {
        await Artwork.findByIdAndUpdate(artworkId, { status: 'sold' });
        console.log(`✨ Backup Database Verification Layer: Marked Artwork ${artworkId} as SOLD.`);
      }

      return res.status(201).json({ message: "Payment verified and saved successfully", transaction: existingTx });
    }

    res.status(400).json({ message: "Payment was not completed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Verification system error", error: error.message });
  }
};

exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`❌ Webhook security validation failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { type, artworkId, userId, originalBdtPrice } = session.metadata;

    try {
      const finalBdtAmount = originalBdtPrice ? Number(originalBdtPrice) : Math.round((session.amount_total / 100) * BDT_TO_USD_RATE);
      const cleanSessionId = session.id;
      
      const duplicateCheck = await Transaction.findOne({ transactionId: cleanSessionId });
      
      if (!duplicateCheck) {
        const transaction = new Transaction({
          transactionId: cleanSessionId,
          type: type,
          buyerId: userId,
          artworkId: type === 'purchase' ? artworkId : undefined,
          amount: finalBdtAmount,
          buyerEmail: session.customer_details?.email,
          status: 'successful'
        });
        await transaction.save();

        if (type === 'purchase') {
          await Artwork.findByIdAndUpdate(artworkId, { status: 'sold' });
        }
      }
    } catch (dbErr) {
      console.error('❌ Database sequence storage fault inside webhook trigger:', dbErr);
      return res.status(500).send('Database storage fault');
    }
  }

  res.status(200).json({ received: true });
};

exports.getMyTransactions = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID parameter is missing." 
      });
    }

    // Explicitly fetching successful logs, making sure internal object mappings align perfectly
    const transactions = await Transaction.find({ buyerId: userId, status: 'successful' })
      .populate({
        path: 'artworkId',
        populate: { path: 'artist', select: 'name email' }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ 
      success: true, 
      data: transactions 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch user transaction logs", 
      error: error.message 
    });
  }
};