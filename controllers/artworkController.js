const Artwork = require("../models/Artwork");

// @desc    Get all artworks with advanced searching, pagination, sorting, and category filters
// @route   GET /api/artworks
// @access  Public
exports.getAllArtworks = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort, page = 1, limit = 8 } = req.query;
    
    let query = { status: { $ne: "unpublished" } };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { tag: { $regex: search, $options: "i" } }
      ];
    }

    if (category && category !== "All") {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sortOptions = { createdAt: -1 }; 
    if (sort === "price-low") sortOptions = { price: 1 };
    if (sort === "price-high") sortOptions = { price: -1 };

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const totalItems = await Artwork.countDocuments(query);
    const artworks = await Artwork.find(query)
      .populate("artist", "name email img")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: artworks.length,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
        currentPage: pageNum,
        limit: limitNum
      },
      data: artworks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Singular Art Object Metadata Profile
// @route   GET /api/artworks/:id
// @access  Public
exports.getArtworkById = async (req, res) => {
  try {
    const artwork = await Artwork.findById(req.params.id).populate("artist", "name email img");
    if (!artwork) {
      return res.status(404).json({ success: false, message: "Artwork item not found in repository." });
    }
    return res.status(200).json({ success: true, data: artwork });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Publish a new creative artwork asset
// @route   POST /api/artworks
// @access  Public (Expects authUser in body payload)
exports.createArtwork = async (req, res) => {
  try {
    const { name, description, price, category, img, tag, authUser } = req.body;
    
    if (!authUser || (authUser.role !== "artist" && authUser.role !== "admin")) {
      return res.status(403).json({ success: false, message: "Unauthorized asset publication access." });
    }

    const newArtwork = await Artwork.create({
      name,
      description,
      price,
      category,
      img,
      tag,
      artist: authUser.id, 
    });

    return res.status(201).json({ success: true, data: newArtwork });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update specific asset details
// @route   PUT /api/artworks/:id
// @access  Public (Expects authUser in body payload)
exports.updateArtwork = async (req, res) => {
  try {
    const { authUser, ...updateData } = req.body;
    
    let artwork = await Artwork.findById(req.params.id);
    if (!artwork) {
      return res.status(404).json({ success: false, message: "Artwork asset target missing." });
    }

    if (!authUser || (artwork.artist.toString() !== authUser.id && authUser.role !== "admin")) {
      return res.status(403).json({ success: false, message: "Resource modification access denied." });
    }

    artwork = await Artwork.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({ success: true, data: artwork });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete or permanently remove asset from registry listing base
// @route   DELETE /api/artworks/:id
// @access  Public (Expects authUser in body payload)
exports.deleteArtwork = async (req, res) => {
  try {
    const { authUser } = req.body;
    const artwork = await Artwork.findById(req.params.id);
    if (!artwork) {
      return res.status(404).json({ success: false, message: "Artwork reference not resolved." });
    }

    if (!authUser || (artwork.artist.toString() !== authUser.id && authUser.role !== "admin")) {
      return res.status(403).json({ success: false, message: "Resource destruction access denied." });
    }

    await artwork.deleteOne();
    return res.status(200).json({ success: true, message: "Artwork asset purged successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};