import LegacyERP from "@/app/components/enterprise/LegacyERP";
export default async function ERPModulePage({params}:{params:Promise<{module:string}>}){ const {module}=await params; return <LegacyERP module={module}/>; }
