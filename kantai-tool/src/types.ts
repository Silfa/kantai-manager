export interface RawShip {
  api_id: number;
  api_ship_id: number;
  api_lv: number;
  api_kyouka: number[];
  api_exp: number[];
  api_slot_ex: number;
}

export interface ShipMasterData {
  name: string;
  stype: number;
  sortId?: number;
}

export interface ApiMstShip {
  api_id: number;
  api_name: string;
  api_stype: number;
  api_sortno?: number;
  api_sort_id?: number;
}

export interface ApiMstStype {
  api_id: number;
  api_name: string;
}
