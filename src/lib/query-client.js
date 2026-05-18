import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
			retryDelay: 3000,
			staleTime: 2 * 60_000,    // 2 min — menos refetches
			gcTime: 15 * 60_000,      // cache mantido por 15 min (economiza dados em rede fraca)
			networkMode: "offlineFirst", // usa cache mesmo offline
		},
	},
});