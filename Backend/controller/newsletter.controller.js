import NewsletterSubscriber from "../models/newsletter.model.js";

export const subscribeNewsletter = async (req, res) => {
  try {
    const { email, name } = req.body;

    const subscriber = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      { email, name, isActive: true, unsubscribedAt: null },
      { new: true, upsert: true }
    );

    res.status(201).json(subscriber);
  } catch (err) {
    res.status(400).json({ message: "Failed to subscribe" });
  }
};

export const unsubscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    const subscriber = await NewsletterSubscriber.findOneAndUpdate(
      { email },
      { isActive: false, unsubscribedAt: new Date() },
      { new: true }
    );

    if (!subscriber) {
      return res.status(404).json({ message: "Subscriber not found" });
    }

    res.json(subscriber);
  } catch (err) {
    res.status(400).json({ message: "Failed to unsubscribe" });
  }
};
