const express = require('express');
const router = express.Router();
const Token = require('../models/Token');
const { auth, checkRole } = require('../middleware/auth');

// Get current queue status
router.get('/status', async (req, res) => {
  try {
    const currentToken = await Token.findOne({ status: 'in-progress' });
    const waitingTokens = await Token.find({ status: 'waiting' })
      .sort({ isVIP: -1, tokenNumber: 1 })
      .limit(5);

    res.json({
      currentToken,
      waitingTokens
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching queue status', error: error.message });
  }
});

// Move to next token - Protected route for doctors only
router.put('/next', auth, checkRole(['doctor']), async (req, res) => {
  try {
    const io = req.app.get('io');
    if (!io) {
      throw new Error('Socket.IO instance not found');
    }

    // Complete current token if exists
    const currentToken = await Token.findOne({ status: 'in-progress' });
    if (currentToken) {
      currentToken.status = 'completed';
      currentToken.actualTime = new Date();
      await currentToken.save();
    }

    // Get next token
    const nextToken = await Token.findOne({ status: 'waiting' })
      .sort({ isVIP: -1, tokenNumber: 1 });

    if (!nextToken) {
      return res.status(404).json({ message: 'No more tokens in queue' });
    }

    nextToken.status = 'in-progress';
    await nextToken.save();

    // Emit socket event
    io.emit('queueUpdate', {
      currentToken: nextToken,
      action: 'next'
    });

    res.json(nextToken);
  } catch (error) {
    console.error('Next token error:', error);
    res.status(500).json({ message: 'Error moving to next token', error: error.message });
  }
});

// Skip current token - Protected route for doctors only
router.put('/skip/:id', auth, checkRole(['doctor']), async (req, res) => {
  try {
    const io = req.app.get('io');
    if (!io) {
      throw new Error('Socket.IO instance not found');
    }

    const token = await Token.findById(req.params.id);
    if (!token) {
      return res.status(404).json({ message: 'Token not found' });
    }

    token.status = 'skipped';
    await token.save();

    io.emit('queueUpdate', {
      currentToken: token,
      action: 'skip'
    });

    res.json(token);
  } catch (error) {
    console.error('Skip token error:', error);
    res.status(500).json({ message: 'Error skipping token', error: error.message });
  }
});

// Get estimated wait time
router.get('/wait-time', async (req, res) => {
  try {
    const completedTokens = await Token.find({
      status: 'completed',
      actualTime: { $exists: true }
    })
    .sort({ actualTime: -1 })
    .limit(10);

    if (completedTokens.length < 2) {
      return res.json({ averageWaitTime: 15 });
    }

    let totalTime = 0;
    for (let i = 1; i < completedTokens.length; i++) {
      const timeDiff = completedTokens[i-1].actualTime - completedTokens[i].actualTime;
      totalTime += timeDiff;
    }
    const averageTime = totalTime / (completedTokens.length - 1);
    const averageMinutes = Math.round(averageTime / (1000 * 60));

    res.json({ averageWaitTime: averageMinutes });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating wait time', error: error.message });
  }
});

module.exports = router;