import Ably from 'ably';

let ablyClient: Ably.Realtime | null = null;

export function getAblyClient(clientId: string): Ably.Realtime {
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({
      authUrl: '/api/auth',
      authParams: { clientId },
      clientId,
    });
  }
  return ablyClient;
}

// Server-side client for token generation
export function getAblyRest(): Ably.Rest {
  return new Ably.Rest(process.env.ABLY_API_KEY!);
}
