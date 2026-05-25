'use strict';

const axios = require('axios');
const { createLogger } = require('../utils/logger');

const logger = createLogger('engage');

const _client = axios.create({
  baseURL: process.env.ENGAGE_API_URL || 'https://engage.api.com',
  headers: {
    'x-api-key': process.env.ENGAGE_API_KEY || '',
    'content-type': 'application/json',
  },
  timeout: 8000,
});

async function sendEvent(payload) {
  if (process.env.ENGAGE_ENABLED !== 'true') return null;

  try {
    const response = await _client.post('/v1/events', payload);
    logger.info('Event queued', { eventId: response.data.eventId, type: payload.type });
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 409) {
      logger.info('Duplicate event skipped', {
        idempotencyKey: payload.idempotencyKey,
        type: payload.type,
      });
      return null;
    }
    logger.error('Event submission failed', { type: payload.type, err: err.message });
    throw err;
  }
}

async function sendEventBatch(payloads) {
  if (process.env.ENGAGE_ENABLED !== 'true') return null;

  try {
    const response = await _client.post('/v1/events/batch', { events: payloads });
    logger.info('Batch queued', { count: payloads.length });
    return response.data;
  } catch (err) {
    logger.error('Batch submission failed', { count: payloads.length, err: err.message });
    throw err;
  }
}

async function getEvent(eventId) {
  const response = await _client.get(`/v1/events/${eventId}`);
  return response.data;
}

async function getUserDeliveries(userId) {
  const response = await _client.get(`/v1/users/${userId}/deliveries`);
  return response.data;
}

async function getUsers({ limit = 10 } = {}) {
  const response = await _client.get(`/v1/users`, { params: { limit } });
  return response.data;
}

module.exports = { sendEvent, sendEventBatch, getEvent, getUserDeliveries, getUsers };
