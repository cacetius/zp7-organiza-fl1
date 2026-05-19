import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: false,
			staleTime: 5 * 60_000,
			gcTime: 60 * 60_000,
			networkMode: "offlineFirst",
			placeholderData: (prev) => prev,
		},
	},
});