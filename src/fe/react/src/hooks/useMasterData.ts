import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface PaginatedMeta {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginatedMeta;
}

export interface UseMasterDataOptions {
  skip?: boolean;
}

export function useMasterData<T>(endpoint: string, options?: UseMasterDataOptions) {
  const [data, setData] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>({
    page: 1,
    page_size: 10,
    total_count: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState<boolean>(!options?.skip);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (options?.skip) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PaginatedResponse<T>>(endpoint, {
        params: {
          page,
          page_size: 10,
          search,
          search_name: search,
          search_code: search,
        },
      });
      setData(response.data.data || []);
      if (response.data.meta) {
        setMeta(response.data.meta);
      }
    } catch (err: any) {
      console.error(`Error fetching ${endpoint}:`, err);
      setError(err.response?.data?.message || err.message || "Failed to load data");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, search, options?.skip]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    meta,
    loading,
    error,
    page,
    setPage,
    search,
    setSearch,
    refetch: fetchData
  };
}
