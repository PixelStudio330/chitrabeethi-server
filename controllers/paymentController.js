const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// ✨ Import the nodemailer helper modules and aesthetic HTML generators
const { sendDummyEmail } = require('../utils/mailer');
const { getPurchaseTemplate, getSubscriptionTemplate } = require('../utils/emailTemplates');

const BDT_TO_USD_RATE = 127.3314;

exports.createArtworkCheckout = async (req, res) => {
  try {
    const { artworkId, userId, successUrl, cancelUrl } = req.body;

    const artwork = await Artwork.findById(artworkId);
    const user = await User.findById(userId);

    if (!artwork) return res.status(404).json({ message: "Artwork not found" });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (artwork.status === 'sold') return res.status(400).json({ message: "This masterpiece is already sold out" });

    const purchaseCount = await Transaction.countDocuments({ buyerId: userId, type: 'purchase', status: 'successful' });
    
    if (user.subscriptionTier === 'free' && purchaseCount >= 3) {
      return res.status(403).json({ message: "Free Tier limit reached (Max 3). Please upgrade to Pro or Premium!" });
    }
    if (user.subscriptionTier === 'pro' && purchaseCount >= 9) {
      return res.status(403).json({ message: "Pro Tier limit reached (Max 9). Please upgrade to Premium!" });
    }

    const priceInUsdCents = Math.round((artwork.price / BDT_TO_USD_RATE) * 100);

    const fallbackBase = process.env.CLIENT_URL || 'http://localhost:3000';
    const finalSuccessUrl = successUrl || `${fallbackBase}/product-details/${artworkId}?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${fallbackBase}/product-details/${artworkId}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl, 
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
        artworkTitle: artwork.name, // ✨ Passed to avoid repetitive DB hits in mailing loops
        buyerName: user.name,       // ✨ Passed to populate dynamic email literals
        originalBdtPrice: artwork.price.toString()
      }
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ message: "Stripe integration failure", error: error.message });
  }
};

exports.createSubscriptionCheckout = async (req, res) => {
  try {
    const { userId, tier: targetTier } = req.body; 

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let priceInUsd = 0;
    if (targetTier === 'pro') priceInUsd = 9.99;
    else if (targetTier === 'premium') priceInUsd = 19.99;
    else return res.status(400).json({ message: "Invalid target tier chosen." });

    const priceInCents = Math.round(priceInUsd * 100);
    const calculatedBdtPrice = Math.round(priceInUsd * BDT_TO_USD_RATE);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/user?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/user`,
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `ArtHub ${targetTier.toUpperCase()} Subscription Plan`,
              description: `Upgrade your marketplace account limit to ${targetTier === 'pro' ? '9 paintings' : 'unlimited paintings'}.`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'subscription',
        targetTier: targetTier,
        userId: userId,
        buyerName: user.name, // ✨ Passed for mail formatting
        originalBdtPrice: calculatedBdtPrice.toString()
      }
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate subscription session", error: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "Session token parameter missing." });

    let existingTx = await Transaction.findOne({ transactionId: sessionId });
    if (existingTx) {
      return res.status(200).json({ message: "Already verified", transaction: existingTx });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const { type, artworkId, userId, originalBdtPrice, targetTier, artworkTitle, buyerName } = session.metadata;
      const finalBdtAmount = originalBdtPrice ? Number(originalBdtPrice) : Math.round((session.amount_total / 100) * BDT_TO_USD_RATE);
      const recipientEmail = session.customer_details?.email || session.customer_email;

      existingTx = new Transaction({
        transactionId: session.id,
        type: type,
        buyerId: userId,
        artworkId: type === 'purchase' ? artworkId : undefined,
        subscriptionTier: type === 'subscription' ? targetTier : undefined,
        amount: finalBdtAmount,
        buyerEmail: recipientEmail,
        status: 'successful'
      });
      await existingTx.save();

      // ✨ Trigger Automated Email Asynchronously inside fulfillment blocks
      if (type === 'purchase') {
        await Artwork.findByIdAndUpdate(artworkId, { status: 'sold' });
        await User.findByIdAndUpdate(userId, { $inc: { purchasesCount: 1 } });
        
        const subject = `🎨 Invoice Verified: Order for "${artworkTitle || 'Masterpiece'}" Completed!`;
        const htmlContent = getPurchaseTemplate(buyerName || "Collector", artworkTitle || "Masterpiece", finalBdtAmount);
        sendDummyEmail(recipientEmail, subject, htmlContent);
      }

      if (type === 'subscription') {
        await User.findByIdAndUpdate(userId, { subscriptionTier: targetTier });
        
        const subject = `✨ Tier Upgraded: Welcome to ArtHub ${targetTier.toUpperCase()}!`;
        const htmlContent = getSubscriptionTemplate(buyerName || "Enthusiast", targetTier);
        sendDummyEmail(recipientEmail, subject, htmlContent);
      }

      return res.status(201).json({ message: "Payment verified successfully", transaction: existingTx });
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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { type, artworkId, userId, originalBdtPrice, targetTier, artworkTitle, buyerName } = session.metadata;
    const recipientEmail = session.customer_details?.email || session.customer_email;

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
          subscriptionTier: type === 'subscription' ? targetTier : undefined,
          amount: finalBdtAmount,
          buyerEmail: recipientEmail,
          status: 'successful'
        });
        await transaction.save();

        // ✨ Trigger Webhook-level Nodemailer fallback delivery thread
        if (type === 'purchase') {
          await Artwork.findByIdAndUpdate(artworkId, { status: 'sold' });
          await User.findByIdAndUpdate(userId, { $inc: { purchasesCount: 1 } });
          
          const subject = `🎨 Invoice Verified: Order for "${artworkTitle || 'Masterpiece'}" Completed!`;
          const htmlContent = getPurchaseTemplate(buyerName || "Collector", artworkTitle || "Masterpiece", finalBdtAmount);
          sendDummyEmail(recipientEmail, subject, htmlContent);
        }

        if (type === 'subscription') {
          await User.findByIdAndUpdate(userId, { subscriptionTier: targetTier });
          
          const subject = `✨ Tier Upgraded: Welcome to ArtHub ${targetTier.toUpperCase()}!`;
          const htmlContent = getSubscriptionTemplate(buyerName || "Enthusiast", targetTier);
          sendDummyEmail(recipientEmail, subject, htmlContent);
        }
      }
    } catch (dbErr) {
      return res.status(500).send('Database storage fault');
    }
  }

  res.status(200).json({ received: true });
};

exports.getMyTransactions = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "User ID parameter is missing." });

    const transactions = await Transaction.find({ buyerId: userId, status: 'successful' })
      .populate({
        path: 'artworkId',
        populate: { path: 'artist', select: 'name email' }
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch user transaction logs", error: error.message });
  }
};

exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .populate('buyerId', 'name email')
      .populate({
        path: 'artworkId',
        select: 'name price category',
        populate: { path: 'artist', select: 'name email' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to gather global transactions.", error: error.message });
  }
};

exports.getAdminAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({});
    const totalArtists = await User.countDocuments({ role: 'artist' });
    
    const successfulSales = await Transaction.find({ status: 'successful' });
    const totalRevenue = successfulSales.reduce((sum, tx) => sum + tx.amount, 0);
    const totalArtworksSold = successfulSales.filter(tx => tx.type === 'purchase').length;

    const artworks = await Artwork.find({});
    const categoryDistribution = {};
    artworks.forEach(art => {
      categoryDistribution[art.category] = (categoryDistribution[art.category] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      metrics: {
        totalUsers,
        totalArtists,
        totalArtworksSold,
        totalRevenue
      },
      categoryDistribution
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Analytics stream aggregation failure.", error: error.message });
  }
};