"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/card";

const LocationMap = dynamic(() => import("./location-map"), { ssr: false, loading: () => <Skeleton className="h-64" /> });
export default LocationMap;
