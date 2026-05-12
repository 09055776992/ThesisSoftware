import User from "../models/user.model.js";

// GET /api/users/me
export const getMe = async (req, res) => {
  // Expect userId from middleware or query/body for now
  const userId = req.userId || req.query.userId || req.body.userId;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const safeUser = {
      id: user._id.toString(),
      name: user.userName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };

    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
};

// PUT /api/users/me
export const updateMe = async (req, res) => {
  const userId = req.userId || req.query.userId || req.body.userId;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  const { name, phone, address } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        ...(name && { userName: name }),
        ...(phone && { phone }),
        ...(address && { address }),
      },
      { new: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const safeUser = {
      id: user._id.toString(),
      name: user.userName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };

    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// GET /api/users (admin)
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().lean();
    const safeUsers = users.map((u) => ({
      id: u._id.toString(),
      name: u.userName,
      email: u.email,
      phone: u.phone,
      address: u.address,
      role: u.role,
    }));

    res.json(safeUsers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// PATCH /api/users/:id (admin)
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, role } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      id,
      {
        ...(name && { userName: name }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(role && { role }),
      },
      { new: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const safeUser = {
      id: user._id.toString(),
      name: user.userName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    };

    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: "Failed to update user" });
  }
};
