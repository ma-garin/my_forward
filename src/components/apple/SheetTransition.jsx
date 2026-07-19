import { forwardRef } from 'react'
import Slide from '@mui/material/Slide'

// iOS のシート提示風トランジション。下からせり上がり、
// iOS に近いディセラレート・カーブで減速する。
// MUI Dialog の TransitionComponent として使用（react-transition-group 互換）。
const SheetTransition = forwardRef(function SheetTransition(props, ref) {
  return (
    <Slide
      direction="up"
      ref={ref}
      easing={{
        enter: 'cubic-bezier(0.32, 0.72, 0, 1)',
        exit: 'cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      timeout={{ enter: 420, exit: 280 }}
      {...props}
    />
  )
})

export default SheetTransition
