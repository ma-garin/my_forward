import { Stack, Chip } from '@mui/material'
import { visibleCardList } from '../utils/cardVisibility'

// 支払い元を選ぶチップの並び。クレカタブの切替・手動入力・編集ダイアログで共通。
// 画面ごとに書くと、折り返しの有無や選択色の付け方が食い違う（実際に 1 行に
// 押し込んで端が切れていた）。
//
// 並べるのは「表示中のカード」＋ 今選んでいるカード（隠されていても、外すと
// 現在値が選べない）。5 枚を超えると親の幅に収まらないので折り返す。
export default function CardChips({ value, onChange, size = 'small', gap = 1 }) {
  return (
    <Stack direction="row" gap={gap} sx={{ flexWrap: 'wrap', minWidth: 0 }}>
      {visibleCardList(value).map((c) => (
        <Chip key={c.id} label={c.shortName} size={size} onClick={() => onChange(c.id)}
          variant={value === c.id ? 'filled' : 'outlined'}
          sx={{
            fontWeight: 600, fontSize: 12,
            bgcolor: value === c.id ? c.color : 'transparent',
            color: value === c.id ? '#fff' : 'text.secondary',
            borderColor: c.color,
          }} />
      ))}
    </Stack>
  )
}
